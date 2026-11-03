#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
clash-interval-fix.py — 给 Clash Verge Rev 的所有订阅自动挂上「测速间隔 = 300 秒」脚本

为什么需要它
------------
很多机场订阅把 proxy-groups 里的 url-test / fallback 组 interval 写死成 86400（一天）。
结果是：节点挂了，Clash 要等一天才换 → 表现为「隔三差五断几个小时」。

解法
----
在 Clash Verge Rev 的「扩展脚本」里注入一段 JS，每次生成配置时把所有
url-test / fallback / load-balance 组的 interval 强制改成 300，并关闭 lazy。

关键坑（血泪教训）
------------------
* 写 profiles/Script.js 没用！那是空模板，没挂在任何订阅上。
* 真正生效的是 profiles.yaml 里每个订阅的 option.script 指向的那个 .js。
* 所以必须：① 写一个新 .js；② 把每个订阅的 option.script 都指向它。
* 订阅原文（profiles/<uid>.yaml）里的 86400 不会变，那是原料，正常。
* Mihomo 的 lazy 默认是 true：未被当前路由选中的组不会主动测速。
* 因此必须同时设置 lazy: false，否则 interval 是 300 也不会后台刷新。
* 判断成功只看运行时 clash-verge.yaml（或界面延迟数字是否 5 分钟一刷）。

用法
----
  python3 clash-interval-fix.py                 # 自动发现配置目录并修
  python3 clash-interval-fix.py --dir <配置目录>  # 手动指定
  python3 clash-interval-fix.py --interval 600   # 改成别的秒数
  python3 clash-interval-fix.py --dry-run        # 只看不动
  python3 clash-interval-fix.py --verify         # 只验证当前状态
  python3 clash-interval-fix.py --list           # 列出订阅和挂载关系
"""

import argparse
import glob
import io
import json
import os
import platform
import re
import shutil
import sys
import time

# Windows 控制台默认 GBK，emoji 会崩；统一转 UTF-8 并降级为 ASCII 符号
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

APP_DIR_NAME = "io.github.clash-verge-rev.clash-verge-rev"

SCRIPT_TEMPLATE = '''// Clash Verge Rev 扩展脚本 —— 自动把测速间隔强制为 {interval} 秒并启用后台检查
// 由 clash-interval-fix.py 生成，可重复执行，勿手改
function main(config, profileName) {{
  var TARGET_INTERVAL = {interval};
  var groups = config["proxy-groups"];
  if (!Array.isArray(groups)) return config;
  var changed = [];
  for (var i = 0; i < groups.length; i++) {{
    var g = groups[i];
    if (!g || typeof g !== "object") continue;
    var t = g["type"];
    if (t === "url-test" || t === "fallback" || t === "load-balance") {{
      var old = g["interval"];
      g["interval"] = TARGET_INTERVAL;
      g["lazy"] = false;
      if (old !== TARGET_INTERVAL) changed.push((g["name"] || "?") + ":" + old + "->" + TARGET_INTERVAL);
    }} else if (t === "select" && Array.isArray(g["proxies"]) && g["proxies"].indexOf("自动选择") !== -1) {{
      g["proxies"] = ["自动选择"];
      delete g["default-selected"];
    }}
  }}
  if (changed.length > 0 && typeof console !== "undefined") {{
    console.log("[clash-interval-fix] " + changed.join(", "));
  }}
  return config;
}}
'''

SCRIPT_FILENAME = "interval-fix.js"
SCRIPT_UID = "intervalFix"      # profiles.yaml 里的 uid，固定住便于重复识别


def backup_file(path):
    """创建不覆盖已有备份的唯一副本。"""
    base = path + ".bak-" + time.strftime("%Y%m%d-%H%M%S")
    candidate = base
    index = 1
    while os.path.exists(candidate):
        candidate = "%s-%d" % (base, index)
        index += 1
    shutil.copy2(path, candidate)


# ---------------------------------------------------------------- 发现配置目录
def find_config_dirs():
    """返回所有可能的 Clash Verge Rev 配置目录（跨平台）。"""
    home = os.path.expanduser("~")
    sysname = platform.system()
    found = []

    if sysname == "Windows":
        for env in ("APPDATA", "LOCALAPPDATA"):
            base = os.environ.get(env)
            if base:
                p = os.path.join(base, APP_DIR_NAME)
                if os.path.isdir(p):
                    found.append(p)
        # 便携版可能放在程序目录旁边
        program_files = os.environ.get("ProgramFiles")
        patterns = [home + r"\AppData\Roaming\*"]
        if program_files:
            patterns.insert(0, os.path.join(program_files, "Clash Verge", "*"))
        for pat in patterns:
            for p in glob.glob(pat):
                if os.path.isdir(os.path.join(p, "profiles")):
                    found.append(p)
    elif sysname == "Darwin":
        cands = [
            os.path.join(home, "Library/Application Support", APP_DIR_NAME),
            os.path.join(home, "Library/Application Support/clash-verge"),
            os.path.join(home, ".config", APP_DIR_NAME),
        ]
        found += [p for p in cands if os.path.isdir(p)]
    else:  # Linux
        cands = [
            os.path.join(home, ".local/share", APP_DIR_NAME),
            os.path.join(home, ".config", APP_DIR_NAME),
            os.path.join(home, ".config", "clash-verge"),
        ]
        xdg = os.environ.get("XDG_DATA_HOME")
        if xdg:
            cands.insert(0, os.path.join(xdg, APP_DIR_NAME))
        found += [p for p in cands if os.path.isdir(p)]

    # 去重，只保留真正含 profiles 的
    out = []
    for p in found:
        p = os.path.realpath(p)
        if p not in out and os.path.isdir(os.path.join(p, "profiles")):
            out.append(p)
    return out


# ---------------------------------------------------------------- 解析 profiles.yaml
def load_profiles_yaml(cfg_dir):
    """极简 YAML 解析：取 current 和 items（含 option.script / option.merge）。

    Clash Verge 生成的 profiles.yaml 结构固定，不引入 PyYAML 依赖。
    """
    path = os.path.join(cfg_dir, "profiles.yaml")
    if not os.path.exists(path):
        return None, None
    text = open(path, encoding="utf-8", errors="replace").read()
    current = None
    m = re.search(r"^current:\s*(\S+)\s*$", text, re.M)
    if m:
        current = m.group(1)

    items = []
    cur = None
    in_option = False
    for raw in text.split("\n"):
        if not raw.strip():
            continue
        stripped = raw.strip()
        indent = len(raw) - len(raw.lstrip())

        if stripped.startswith("- uid:"):
            cur = {"uid": stripped.split(":", 1)[1].strip()}
            items.append(cur)
            in_option = False
            continue
        if cur is None:
            continue
        # 顶层（indent 0）出现新的 key，说明 items 结束
        if indent == 0 and not stripped.startswith("-"):
            cur = None
            in_option = False
            continue
        if stripped == "option:":
            in_option = True
            continue
        if ":" in stripped:
            k, v = stripped.split(":", 1)
            k = k.strip()
            v = v.strip().strip("'\"")
            if in_option:
                if indent >= 4:
                    cur.setdefault("_opt", {})[k] = v if v not in ("", "null") else None
            else:
                if k in ("type", "file", "name", "url", "updated") and "_top" not in cur or k in ("type", "file", "name", "url"):
                    cur.setdefault(k, v if v not in ("", "null") else None)
    # 展平 option 字段到顶层便于读取
    for it in items:
        opt = it.pop("_opt", {})
        for k, v in opt.items():
            it["opt_" + k] = v
    return text, {"current": current, "items": items}


def list_subscriptions(items):
    """只挑 type: remote 的（真正的订阅）。"""
    return [it for it in items if it.get("type") == "remote"]


# ---------------------------------------------------------------- 写入脚本
def write_script(cfg_dir, interval, dry_run=False):
    prof_dir = os.path.join(cfg_dir, "profiles")
    target = os.path.join(prof_dir, SCRIPT_FILENAME)
    content = SCRIPT_TEMPLATE.format(interval=interval)
    old = None
    if os.path.exists(target):
        old = open(target, encoding="utf-8", errors="replace").read()
        if old == content:
            return target, False
    if dry_run:
        return target, old is not None or not os.path.exists(target)
    if old is not None:
        backup_file(target)
    open(target, "w", encoding="utf-8").write(content)
    return target, True


def ensure_item(cfg_dir, dry_run=False):
    """确保 profiles.yaml 里有 intervalFix 这个 script item。"""
    path = os.path.join(cfg_dir, "profiles.yaml")
    text = open(path, encoding="utf-8", errors="replace").read()
    if re.search(r"^- uid:\s*%s\s*$" % re.escape(SCRIPT_UID), text, re.M):
        return False
    block = ("- uid: %s\n  type: script\n  name: null\n  file: %s\n  updated: %d\n"
             % (SCRIPT_UID, SCRIPT_FILENAME, int(time.time())))
    # 插到 items: 之后
    if re.search(r"^items:\s*$", text, re.M):
        text = re.sub(r"^items:\s*$", "items:\n" + block.rstrip("\n"), text, count=1, flags=re.M)
    else:
        text = text.rstrip("\n") + "\nitems:\n" + block.rstrip("\n") + "\n"
    if not dry_run:
        backup_file(path)
        open(path, "w", encoding="utf-8").write(text)
    return True


def attach_to_subscriptions(cfg_dir, dry_run=False):
    """把每个 remote 订阅的 option.script 指向 SCRIPT_UID。

    做法：逐个 item 处理，遇到 option: 块就逐行重写（替换或插入 script:）。
    """
    path = os.path.join(cfg_dir, "profiles.yaml")
    lines = open(path, encoding="utf-8", errors="replace").read().split("\n")
    out = []
    changed = []
    i = 0
    cur_uid = None
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if stripped.startswith("- uid:"):
            cur_uid = stripped.split(":", 1)[1].strip()
        if stripped == "option:":
            indent = len(line) - len(line.lstrip())
            out.append(line)
            i += 1
            block = []
            while i < len(lines):
                s = lines[i].strip()
                ind = len(lines[i]) - len(lines[i].lstrip()) if s else 999
                if s and ind <= indent:
                    break
                block.append(lines[i])
                i += 1
            # 在 block 里找 script:
            found = False
            for b in block:
                if b.strip().startswith("script:"):
                    found = True
                    old = b.split(":", 1)[1].strip()
                    if old != SCRIPT_UID:
                        pad = " " * (len(b) - len(b.lstrip()))
                        out.append(pad + "script: " + SCRIPT_UID)
                        changed.append("%s: %s -> %s" % (cur_uid, old or "空", SCRIPT_UID))
                    else:
                        out.append(b)
                else:
                    out.append(b)
            if not found:
                # 插到 option 块第一行
                pad = " " * (indent + 2)
                out.append(pad + "script: " + SCRIPT_UID)
                changed.append("%s: (无) -> %s" % (cur_uid, SCRIPT_UID))
            continue
        out.append(line)
        i += 1

    if changed and not dry_run:
        backup_file(path)
        open(path, "w", encoding="utf-8").write("\n".join(out))
    return changed


# ---------------------------------------------------------------- 验证
def verify(cfg_dir, interval):
    """读运行时 clash-verge.yaml，检查组 interval 和 lazy 实际值。"""
    rt = os.path.join(cfg_dir, "clash-verge.yaml")
    if not os.path.exists(rt):
        return None, "找不到 clash-verge.yaml（Clash 未启动过？）"
    text = open(rt, encoding="utf-8", errors="replace").read()
    result = []
    for m in re.finditer(r"(?ms)^- name:\s*([^\n]+)\n(.*?)(?=^- name:|\Z)", text):
        name = m.group(1).strip()
        block = m.group(2)
        type_match = re.search(r"(?m)^\s+type:\s*(url-test|fallback|load-balance)\s*$", block)
        if not type_match:
            continue
        interval_match = re.search(r"(?m)^\s+interval:\s*(\d+)\s*$", block)
        lazy_match = re.search(r"(?m)^\s+lazy:\s*(true|false)\s*$", block)
        result.append((
            name,
            type_match.group(1),
            int(interval_match.group(1)) if interval_match else None,
            lazy_match.group(1) == "false" if lazy_match else False,
        ))
    return result, None


def verify_select_defaults(cfg_dir):
    """检查包含“自动选择”的 select 组是否只保留该子组。"""
    rt = os.path.join(cfg_dir, "clash-verge.yaml")
    text = open(rt, encoding="utf-8", errors="replace").read()
    result = []
    for m in re.finditer(r"(?ms)^- name:\s*([^\n]+)\n(.*?)(?=^- name:|\Z)", text):
        name = m.group(1).strip()
        block = m.group(2)
        if not re.search(r"(?m)^\s+type:\s*select\s*$", block):
            continue
        children = [item.strip() for item in
                    re.findall(r"(?m)^\s+-\s*(.+?)\s*$", block)]
        if "自动选择" not in children:
            continue
        result.append((name, children == ["自动选择"]))
    return result


def main():
    ap = argparse.ArgumentParser(description="给 Clash Verge Rev 所有订阅挂上测速间隔覆盖脚本")
    ap.add_argument("--dir", help="Clash Verge 配置目录（默认自动发现）")
    ap.add_argument("--interval", type=int, default=300, help="目标间隔秒数，默认 300")
    ap.add_argument("--dry-run", action="store_true", help="只显示要做什么，不写文件")
    ap.add_argument("--verify", action="store_true", help="只验证当前运行时状态")
    ap.add_argument("--list", action="store_true", help="列出配置目录和订阅")
    args = ap.parse_args()

    dirs = [args.dir] if args.dir else find_config_dirs()
    if not dirs:
        print("[FAIL] 没找到 Clash Verge Rev 配置目录")
        print("   试过：APPDATA / XDG_DATA_HOME / ~/.local/share / ~/Library/Application Support")
        print("   可用 --dir 手动指定")
        return 1

    rc = 0
    for cfg in dirs:
        print("=" * 62)
        print("配置目录: %s" % cfg)
        text, meta = load_profiles_yaml(cfg)
        if meta is None:
            print("  [WARN]  没有 profiles.yaml，跳过")
            continue
        subs = list_subscriptions(meta["items"])
        print("  当前订阅: %s" % meta["current"])
        print("  订阅数: %d" % len(subs))
        for s in subs:
            print("    - %s  (uid=%s, script=%s)"
                  % (s.get("file", "?"), s.get("uid"), s.get("opt_script") or "无"))

        if args.list:
            continue

        if args.verify or args.dry_run:
            res, err = verify(cfg, args.interval)
            if err:
                print("  验证失败: %s" % err)
                rc = 1
                continue
            print("  运行时各组 interval:")
            bad = 0
            if not res:
                print("    [FAIL] 没有找到 url-test / fallback / load-balance 组")
                rc = 1
                continue
            for name, typ, iv, lazy_ok in res:
                ok = "[OK]" if iv == args.interval and lazy_ok else "[FAIL]"
                if iv != args.interval or not lazy_ok:
                    bad += 1
                lazy_text = "false" if lazy_ok else "未关闭"
                interval_text = "%d 秒" % iv if iv is not None else "缺失"
                print("    %s %-16s %-12s interval=%s lazy=%s"
                      % (ok, name[:16], typ, interval_text, lazy_text))
            if bad:
                print("  [WARN]  %d 个组不是 interval=%d + lazy=false" % (bad, args.interval))
                rc = 1
            else:
                print("  [OK] 全部已是 interval=%d + lazy=false" % args.interval)

            select_defaults = verify_select_defaults(cfg)
            for name, ok in select_defaults:
                if ok:
                    print("    [OK] %-16s select        仅含自动选择" % name[:16])
                else:
                    print("    [FAIL] %-16s select        父级组仍含具体节点" % name[:16])
                    rc = 1
            if args.verify:
                continue

        # 实际修复
        target, wrote = write_script(cfg, args.interval, args.dry_run)
        if args.dry_run:
            script_status = "待写入" if wrote else "已是最新"
        else:
            script_status = "已写入" if wrote else "已是最新"
        print("  脚本: %s  %s" % (target, script_status))
        added = ensure_item(cfg, args.dry_run)
        print("  profiles.yaml item: %s" % ("已新增 %s" % SCRIPT_UID if added else "已存在"))
        ch = attach_to_subscriptions(cfg, args.dry_run)
        if ch:
            for c in ch:
                print("  挂载: script %s" % c)
        else:
            print("  挂载: 全部订阅已指向 %s" % SCRIPT_UID)

        if args.dry_run:
            print("  (dry-run，未写入)")
            continue

        print()
        print("  -> 下一步：重启 Clash Verge 让它重新生成配置")
        print("     Linux   : pkill -f '/usr/bin/clash-verge$' 然后重新打开")
        print("     Windows : taskkill /F /IM clash-verge.exe 然后重新打开")
        print("     或直接在界面里「更新订阅」/切换一次订阅")
        print("  -> 然后跑 --verify 确认")

    return rc


if __name__ == "__main__":
    sys.exit(main())
