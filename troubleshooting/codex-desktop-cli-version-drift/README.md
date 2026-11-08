# Codex 桌面版升级后，CLI 要不要跟着升？

> 现象：桌面版升级了（关于里显示 `26.xxxx.xxxxx`），但命令行 `codex --version`
> 还是几个月前的老版本，两者行为不一致。

**一句话结论：桌面版和 CLI 是两条独立的线，各归各的。**
**桌面版升级后，查一下内置 CLI 的版本号，npm 那条落后就手动升一条命令。**

---

## 两条线，互不影响

| | 装在哪 | 谁管 |
|---|---|---|
| **桌面应用** | `%LOCALAPPDATA%\Programs\...`，应用内的 `OpenAI` 目录 | 应用自己更新（托盘提示） |
| **桌面版内置的 CLI** | `%LOCALAPPDATA%\OpenAI\Codex\bin\<哈希>\codex.exe` | 跟着桌面版走，哈希目录每版都变 |
| **npm 全局 `codex`** | `%APPDATA%\npm\codex.cmd` | 你，用 `npm i -g` |

**⇒ 升级桌面版**不会**动 npm 那个 `codex`。**

2026-11-08 实测的落差：

```
桌面应用          26.1103.32239      (Nov 6, 2026)
  └ 内置 CLI      0.167.0-alpha.3.2
npm 全局 codex    0.147.0            ← 差 20 个小版本
```

## 怎么看两个版本

```bat
:: 桌面版：打开应用 → 关于（About）→ 看 26.xxxx.xxxxx
:: 内置 CLI 的真实版本：
for /d %d in ("%LOCALAPPDATA%\OpenAI\Codex\bin\*") do @if exist "%d\codex.exe" @"%d\codex.exe" --version

:: npm 那条：
codex --version
```

## 升级 CLI：一条命令

先去上面那行拿到内置 CLI 的版本，再照抄：

```bat
npm install -g @openai/codex@0.167.0-alpha.3.2
```

**几秒完成。升完 `codex --version` 应该和内置那个一致。**

## 为什么不用包装脚本自动同步

试过，放弃了。做一个 `codex-cli.cmd` 每次扫描取最新内置 exe，看着聪明，实际有两个坑：

1. **多一层间接** —— 排查问题时不知道到底跑的是哪个二进制，`where codex` 也骗人
2. **自动同步 npm 不可靠** —— 脚本里 `start /b` 起的后台进程在 SSH / 计划任务会话里会被回收，装到一半就没了

**约定：桌面版归桌面版，CLI 归 CLI；要同步就显式跑一条命令。**

---

## 从 SSH / 计划任务调用 `codex` 的一个坑

在**没有终端**的环境里调 `codex`，它会先打印：

```
Reading additional input from stdin...
```

然后**无限等标准输入**，看起来像卡死。加一个空输入重定向即可：

```bat
codex exec --dangerously-bypass-approvals-and-sandbox "任务" < NUL
```

或者放进计划任务（`schtasks`）让它有一个会话。**这不是配置问题，是调用方式问题。**

---

## 顺带：`config.toml` 里两项已废弃

新版每次启动都刷警告，删掉即可：

```toml
disable_response_storage = true
preferred_auth_method = "apikey"
```

**改这个文件有个陷阱**：PowerShell 5.1 的 `Set-Content -Encoding UTF8` **会写 BOM**，
而且管道读写会按当前代码页猜编码，**中文路径会被截断**：

```
改前  [projects.'...\桌面\公安厅低空经济']
改后  [projects.'...\桌面\公安厅低空经']
      → Error loading config.toml: unclosed table, expected ]
```

安全写法（逐字节保留、无 BOM）：

```powershell
$p = "$env:USERPROFILE\.codex\config.toml"
$t = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)
$enc = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($p, $t, $enc)
```

**动手前备份，改完验三项：行数、中文行是否还在、废弃项是否为 0。**
