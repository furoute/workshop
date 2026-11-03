# 使用说明：Clash Verge Rev 测速间隔修复

> 给智能体看也给人看。四步走完，5 分钟一次体检，节点挂了不再傻等一天。

---

## 一、这玩意儿解决什么问题

```

现状  机场订阅把 interval 写死成 86400 秒（一天）
      ⇒ 「自动选择」一天只体检一次
      ⇒ 中午节点被限速/挂掉，它不知道，还一直往死节点上发请求
      ⇒ 您的体感：隔三差五断几个小时

修完  每 300 秒（5 分钟）体检一次
      ⇒ 节点挂了，5 分钟内自动跳到最快的那个
      ⇒ 同时设置 lazy: false，未直接选中的自动组也会在后台测速
      ⇒ 自建的手动组（如 ChatGPT 专用组）保持不动，不会被乱跳
```

---

## 二、四步走

### 第 1 步：看一眼现状

```bash
python3 clash-interval-fix.py --list
```

输出示例：

```
配置目录: <配置目录>
  当前订阅: RzbL6ODLWeB9
  订阅数: 2
    - 订阅A.yaml      (uid=<订阅UID>, script=intervalFix)
    - 订阅B.yaml      (uid=<订阅UID>, script=intervalFix)
```

**重点看 `script=` 那一栏：**
- 显示 `intervalFix` → 已经挂好
- 显示别的、或显示「无」→ 需要修

### 第 2 步：修

```bash
python3 clash-interval-fix.py --interval 300
```

它会做五件事：

```
① 在 profiles/ 下写一个 interval-fix.js（扩展脚本）
② 在 profiles.yaml 里登记这个脚本
③ 把每个订阅（type: remote）的 option.script 都指向它
④ 给 url-test / fallback / load-balance 设置 interval: 300 和 lazy: false
⑤ 把包含“自动选择”的父级 select 组收窄为只包含“自动选择”
⑥ 用唯一文件名备份改过的文件
```

想先看它要干什么、不真改：

```bash
python3 clash-interval-fix.py --dry-run
```

### 第 3 步：重启 Clash Verge

脚本是在**生成配置时**执行的，所以改完必须让 Clash Verge 重新生成一次。

```bash
# Linux
pkill -f '/usr/bin/clash-verge$'
# 然后重新打开

# Windows（从 SSH 里 Popen 起的 GUI 程序会随 SSH 断开被杀，必须走计划任务）
schtasks /run /tn "ACP-CV-Start"

# macOS
killall "Clash Verge"; open -a "Clash Verge"

# 或者最简单：在界面里点一次「更新订阅」/切换一次订阅
```

### 第 4 步：验证

```bash
python3 clash-interval-fix.py --verify
```

期望输出：

```
运行时各组 interval:
  [OK] 自动选择             url-test     interval=300 秒 lazy=false
  [OK] 故障转移             fallback     interval=300 秒 lazy=false
[OK] 全部已是 interval=300 + lazy=false
```

---

## 三、四个必须知道的坑

### 坑 1：改 `profiles/<订阅uid>.yaml` 没用

```
那个文件是订阅原文（原料）
机场下发时写的是 86400
您改完那一刻看着对，订阅一刷新立刻还原
⇒ 这是正常现象，不用纠结
⇒ 判断成败只能看「运行时」（clash-verge.yaml）或界面延迟数字
```

### 坑 2：改 `profiles/Script.js` 也没用

```
那是 Clash Verge 自带的空模板
function main(config, profileName) { return config; }
⇒ 什么也不做
⇒ 真正生效的是 profiles.yaml 里每个订阅 option.script 指向的那个 .js
⇒ 所以必须写新文件 + 逐订阅挂载，光有代码不管用
```

### 坑 3：别用「扩展覆写配置（Merge）」

```
Merge 对 proxy-groups 是「整体替换」，不是逐项合并
⇒ 写进去会把整张代理组列表冲掉（官方 issue #4565 明确说过）
⇒ 改 interval 只能用「扩展脚本」
```

### 坑 4：只改 interval 仍然可能不测速

```
Mihomo 的 lazy 默认是 true
⇒ 路由没有直接选中的自动组不会主动体检
⇒ 本脚本必须同时写 lazy: false

测速刷新也不等于实际切换：
规则 → 父级选择组 → 自动选择 → 最佳节点
⇒ 父级选择组如果仍固定某个具体节点，它会绕过“自动选择”
⇒ 需要在界面里把父级选择组切到“自动选择”
⇒ default-selected 不能指向代理组
⇒ 扩展脚本会把父级 select 组收窄为 proxies: [自动选择]
⇒ 规则入口不变，重启后也不会掉回具体节点
```

### 坑 5：界面延迟值与自动组可能使用了不同测速地址

```
Clash Verge 界面默认：
http://cp.cloudflare.com/generate_204

订阅自动组常见：
http://www.gstatic.com/generate_204

两个地址测出的最低节点可能不同
⇒ 想看到“界面最低 = 自动组选中”，两边要用同一个 URL
⇒ 可在 Clash Verge 设置里统一“默认延迟测试链接”
```

---

## 四、支持范围（说清楚边界）

| 项目 | 支持情况 |
|:--|:--|
| Windows 10/11 | ✅ 实测通过 |
| Linux（Ubuntu/Debian 等） | ✅ 实测通过 |
| macOS | ⚠️ 代码写了路径，未实机验证 |
| 订阅数量 | ✅ 1 个、2 个、3 个……自动全挂 |
| 订阅名字 | ✅ 完全无关，按 `type: remote` 识别 |
| `url-test` 组（自动选择） | ✅ 强制 `interval: 300`、`lazy: false` |
| `fallback` 组（故障转移） | ✅ 强制 `interval: 300`、`lazy: false` |
| `load-balance` 组（负载均衡） | ✅ 强制 `interval: 300`、`lazy: false` |
| `select` 组（手动选择，如自建 ChatGPT 组） | ⭕ 不动——本来就没有 interval，也不该乱跳 |
| 标准安装位置 | ✅ 自动发现 |
| 便携版 / 绿色版 | ⚠️ 可能找不到，用 `--dir` 手动指定 |
| 安卓 / iOS 上的 Clash | ❌ 不适用（配置结构不同，也不开本地接口） |

---

## 五、配置目录在哪（想手动指定时用）

| 平台 | 路径 |
|:--|:--|
| Windows | `%APPDATA%\io.github.clash-verge-rev.clash-verge-rev\` |
| Linux | `~/.local/share/io.github.clash-verge-rev.clash-verge-rev/` |
| macOS | `~/Library/Application Support/io.github.clash-verge-rev.clash-verge-rev/` |

⚠️ Windows 上 `%LOCALAPPDATA%` 下也有个同名目录，那是 **WebView 缓存**，不是配置目录，别找错。

```bash
# 手动指定
python3 clash-interval-fix.py --dir "<配置目录>" --interval 300
```

---

## 六、自建的组为什么不动（以 ChatGPT 组为例）

```
您在 Clash Verge 里自建的「ChatGPT」组，类型是 Selector（手动选择）
⇒ 没有 interval 这个概念（不会自动测速换点）
⇒ 脚本按组类型过滤，见到 Selector 直接跳过
⇒ 这是有意为之，不是没覆盖到
```

**为什么不把它改成自动？**

ChatGPT 对出口 IP 很敏感。如果让它自动跳到别的地区，可能触发风控或要求重新验证，对话中途掉线。

**如果希望它在您选的那几个节点里自动轮换：**

```
把组类型从 Selector 改成 Fallback
⇒ 第一个挂了自动试第二个，始终在您挑的那几个里
⇒ 这个改动要在 Clash Verge 界面里做，或者改订阅的 groups 配置
```

---

## 七、命令速查

```bash
python3 clash-interval-fix.py --list              # 列出目录、订阅、挂载情况
python3 clash-interval-fix.py --dry-run           # 预演，不写文件
python3 clash-interval-fix.py --interval 300      # 执行修复（默认就是 300）
python3 clash-interval-fix.py --interval 600      # 想改成 10 分钟也行
python3 clash-interval-fix.py --verify            # 只验证运行时状态
python3 clash-interval-fix.py --dir <路径>        # 手动指定配置目录
```

---

## 八、可选：让智能体远程操作（Clash 本地 API）

跳过界面，直接和 Clash 内核对话。**界面刷新不出来的问题，用它诊断最准。**

```bash
# Linux：Unix socket
SOCK=~/.local/share/io.github.clash-verge-rev.clash-verge-rev/verge-mihomo.sock

# 组内所有节点测速（<组名> 要 URL 编码，如「自动选择」= %E8%87%AA%E5%8A%A8%E9%80%89%E6%8B%A9）
curl -s --unix-socket $SOCK \
  "http://localhost/group/%E8%87%AA%E5%8A%A8%E9%80%89%E6%8B%A9/delay?url=http%3A%2F%2Fwww.gstatic.com%2Fgenerate_204&timeout=5000"

# 当前选中哪个节点
curl -s --unix-socket $SOCK http://localhost/proxies/%E8%87%AA%E5%8A%A8%E9%80%89%E6%8B%A9

# 重载配置（body 里的 path 必须是 clash-verge.yaml 的绝对路径）
curl -X PUT --unix-socket $SOCK "http://localhost/configs?force=true" \
  -d '{"path":"<配置目录>/clash-verge.yaml"}'
```

```bash
# Windows：127.0.0.1:9097，secret 在 verge.yaml / config.yaml 里（字段名 secret）
curl -H "Authorization: Bearer <secret>" http://127.0.0.1:9097/proxies
```

---

## 九、怎么确认真的好了（四个硬判据，缺一不可）

```
① 脚本自检
   python3 clash-interval-fix.py --verify  → 全部 [OK]

② 界面观察
   「自动选择」的节点延迟数字，5 分钟内会变；运行时必须是 lazy=false

③ 实际链路
   父级选择组指向「自动选择」，当前节点约 300 秒随最低延迟变化

④ 断点测试（最硬）
   把订阅原文里的 interval 手动改回 86400
   重启 Clash Verge
   再跑 --verify，仍是 300 + lazy=false  →  说明脚本真在拦
```

---

## 十、出问题怎么查

| 现象 | 原因 | 处理 |
|:--|:--|:--|
| `--verify` 显示 86400 | 订阅没挂上脚本 | 跑一次不带 `--verify` 的修复，再重启 CVR |
| `--verify` 显示 `lazy=未关闭` | 扩展脚本仍是旧版本 | 用新版脚本覆盖 interval-fix.js，再重启 CVR |
| `--verify` 显示父级组未收窄 | 扩展脚本仍是旧版本 | 用新版脚本覆盖 interval-fix.js，再重启 CVR |
| 订阅 `script=` 显示「无」 | 同上 | 同上 |
| 找不到配置目录 | 便携版/绿色版 | `--dir` 手动指定 |
| Windows 下脚本报编码错误 | 控制台 GBK | 本脚本已处理，如仍报错设 `PYTHONIOENCODING=utf-8` |
| 改完界面还是老样子 | 没重启 CVR | 重启一次，或界面里更新一次订阅 |
| 延迟会刷新但节点不切换 | 父级选择组固定了具体节点 | 把父级选择组切到「自动选择」 |
| 切到另一个订阅后失效 | 那个订阅没挂脚本 | 重跑一次脚本（它会扫全部订阅） |

---

## 十一、一句话总结

```
脚本负责「改 interval + 关闭 lazy」，挂载负责「让它执行」，
父级选择组负责「让实际流量走自动选择」。三者都正确才会自动切换。
```
