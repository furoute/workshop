---
name: clash-interval-and-node-fix
description: Use when Clash 节点断或自动切换不灵。修正 interval 并启用稳定自动切换。
version: 1.0.0
author: 蓝莓(Hermes) + Codex@笔记本
license: MIT
metadata:
  hermes:
    tags: [clash, clash-verge, proxy, automation, cross-platform, mihomo]
    related_skills: [system-proxy-config, blocked-page-recovery]
---

# Clash Verge Rev 自动切换失效修复

## 症状

节点隔几小时断一次，明明设了「自动选择」也一直卡在死节点上。

## 根因

机场订阅把 `proxy-groups` 的 `interval` 写死成 **86400 秒（一天）**。
`url-test` 组只在 interval 到点时才重测选点——所以节点中午挂了，要等第二天才换走。
另外 Mihomo 的 `lazy` 默认是 **true**：组没有被当前路由直接选中时，即使
`interval: 300` 也不会主动测速。

```
自动选择（url-test）  interval 86400  ← 一天体检一次 → 断了傻等一天
故障转移（fallback）  interval 7200   ← 两小时
```

## 正确解法：扩展脚本 + 逐订阅挂载 + 每隔 300 秒后台检查

### 三个必须知道的坑

1. **改 `profiles/<订阅uid>.yaml` 没用**——那是订阅原文（原料），一更新就回 86400。
   改完那一刻看着对，订阅一刷新就还原。**判断成败只能看运行时。**
2. **改 `profiles/Script.js` 也没用**——那是空模板，没挂在任何订阅上。
   真正生效的是 `profiles.yaml` 里每个订阅 `option.script` 指向的那个 `.js`。
3. **「扩展覆写配置（Merge）」不能改 interval**——`proxy-groups` 是列表，覆写是**整体替换**，
   会把整张组列表冲掉（官方 issue #4565 明确说要用扩展脚本）。
4. **不要往 `profiles.yaml` 里手工新增 script item**——Clash Verge 只认自己登记过的项，
   重启后会把你插进去的 item 删掉，订阅挂载退回旧文件，脚本就白写了。
   **正确做法：把脚本内容直接覆盖写进 `option.script` 当前指向的那个 `.js`**
   （那通常是 96 字节的空模板），改内容不改指向。

### 运行时在哪看

```
<配置目录>/clash-verge.yaml     ← Clash 实际吃进去的，脚本处理后的结果
                                 （这个 300 才算成功）
<配置目录>/profiles/<uid>.yaml  ← 订阅原文，永远 86400，正常
```

## 跨平台一键修

脚本：`scripts/clash-interval-fix.py`（自动发现配置目录，自动给所有订阅挂载）

```bash
python3 clash-interval-fix.py --list           # 列出目录、订阅、当前挂载
python3 clash-interval-fix.py --interval 300   # 修复（默认 300 秒）
python3 clash-interval-fix.py --dry-run        # 只看不动
python3 clash-interval-fix.py --verify         # 验证运行时
```

Windows：`python clash-interval-fix.py --interval 300`

修完必须**重启 Clash Verge**（脚本在生成配置时执行）：

```bash
# Linux
pkill -f '/usr/bin/clash-verge$'; (重新打开)
# Windows（SSH 里 Popen 起的会被杀，必须走计划任务）
schtasks /run /tn "ACP-CV-Start"
```

## 配置目录位置

| 平台 | 路径 |
|:--|:--|
| Windows | `%APPDATA%\io.github.clash-verge-rev.clash-verge-rev\` |
| Linux | `~/.local/share/io.github.clash-verge-rev.clash-verge-rev/` |
| macOS | `~/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev/` |

⚠️ Windows 上 `%LOCALAPPDATA%` 那个同名目录是 WebView 数据，**不是**配置目录。

## 多订阅的关键点

脚本挂在**订阅**上，不是全局。多订阅必须**每个都挂**：

```
订阅 A      option.script: intervalFix  ✅
订阅 B      option.script: intervalFix  ✅  ← 不挂就是裸奔
```

脚本逻辑本身遍历该订阅的全部 `proxy-groups`，对 `url-test` / `fallback` /
`load-balance` 同时设置：

```yaml
interval: 300
lazy: false
```

自建的手动 `select` 组不会被改动。

### 还要确认实际流量走的是自动组

测速刷新不等于实际切换。通常链路应为：

```
规则 → 外部选择组 → 自动选择（url-test） → 当前最佳节点
```

如果父级选择组仍固定选中某个具体节点，它会绕过“自动选择”，
测速虽然刷新，实际流量也不会换节点。请在 Clash Verge 的“代理组”里把父级
选择组切到 `自动选择`。

`default-selected` 不能指向代理组，只能指向具体节点。为保证重启后不回落到
旧节点，扩展脚本会把包含 `自动选择` 的父级 `select` 组收窄为：

```yaml
proxies:
  - 自动选择
```

规则名和父级组名保持不变，但重启或订阅更新后，实际出口只能经过自动组。

### 界面延迟和自动组延迟要对齐

Clash Verge 未设置默认延迟测试链接时，界面默认使用
`http://cp.cloudflare.com/generate_204`；订阅里的自动组常见地址是
`http://www.gstatic.com/generate_204`。两者结果可能不同。

如果要让界面显示的最低延迟与自动组选择一致，在 Clash Verge 设置里把
“默认延迟测试链接”设为自动组实际使用的同一个 URL。

## 本地 API（不重启也能操作）

```
Linux    ~/.local/share/.../verge-mihomo.sock
Windows  127.0.0.1:9097   (Authorization: Bearer <verge.yaml 里的 secret>)
```

```bash
# 组测速（让 300 秒立刻生效一次）
curl --unix-socket <sock> "http://localhost/group/<URL编码组名>/delay?url=http://www.gstatic.com/generate_204&timeout=5000"
# 当前节点
curl --unix-socket <sock> http://localhost/proxies/<URL编码组名>
# 重载配置（body 必须是 {"path": "<clash-verge.yaml 绝对路径>"}）
curl -X PUT --unix-socket <sock> "http://localhost/configs?force=true" -d '{"path":"..."}'
```

## 验证成功的硬判据

1. `clash-interval-fix.py --verify` 全部 `[OK]`
2. 运行时各组同时满足 `interval=300` 和 `lazy=false`
3. 实际链路中父级选择组只包含「自动选择」，且重载后仍保持
4. 真实断点测试：把订阅原文改回 86400 → 重启 → 运行时仍是 300

## 已实测环境

| 项目 | 版本 | 平台 | 结果 |
|:--|:--|:--|:--|
| Clash Verge Rev | 2.5.9 | Windows 11 | 实测通过 |
| Clash Verge Rev | 2.5.9 | Ubuntu (Linux) | 实测通过 |
| Mihomo 内核 | v1.19.33 | win / linux amd64 | 实测通过 |
| macOS | — | — | 路径已写，未实机验证 |

验证方式：三个平台各盯两轮 5 分钟，确认节点延迟全部刷新且自动跳到最低。

## 不要做的

- ❌ 不要指望订阅更新后原文变成 300（那是原料，本来就该是 86400）
- ❌ 不要用 Merge 覆写改 interval
- ❌ 不要在 SSH 里 `Popen` 起 Windows GUI 程序（进程会随 SSH 断开被杀），走 `schtasks`
- ❌ Windows 控制台是 GBK，脚本输出别用 emoji（会 UnicodeEncodeError）

## 发布前脱敏清单

技能要公开时，以下内容一个都不能留：

```
订阅 URL 里的域名、路径和 token
真实绝对路径（含用户名的 home 目录）
真实用户名
内网 IP 段
机场的真实节点名（地名 + 机场品牌组合）
```

替代写法：`os.path.expanduser("~")`、`%APPDATA%`、`~/Library/Application Support`、
`订阅 A / 订阅 B`、`节点-01` 这类通用占位。

发布前自查（把 pattern 换成你自己环境的特征词）：

```bash
python3 - <<'PY'
import re, os
# 换成你自己的：订阅域名片段、用户名、内网网段
PATTERN = r"<your-sub-domain>|<your-username>|<your-lan-prefix>"
for root, _, files in os.walk("."):
    for f in files:
        p = os.path.join(root, f)
        try:
            t = open(p, encoding="utf-8").read()
        except Exception:
            continue
        hits = re.findall(PATTERN, t)
        if hits:
            print(p, set(hits))
PY
```

