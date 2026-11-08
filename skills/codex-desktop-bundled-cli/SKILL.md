---
name: codex-desktop-bundled-cli
description: Use when 想用桌面版 Codex 自带的 CLI。自动发现版本路径 + 三个坑（桌面占用、stdin、config BOM）。
---

# 用桌面版 Codex 自带的 CLI（版本自动跟随）

> 环境：Windows 11 · Codex 桌面应用（关于里显示 `26.xxxx.xxxxx`）· 2026-11-08 实测

## 问题

Codex 桌面版每次升级，会把自己那套 CLI 解包到：

```
%LOCALAPPDATA%\OpenAI\Codex\bin\<哈希>\codex.exe
```

**哈希目录名每个版本都不同**，所以不能写死路径。而 npm 全局装的那个 `codex` 是另一条独立的线，版本往往落后很多（实测差 20 个小版本）。

结果就是：桌面版用的是新版，`codex` 命令却还是老版，两边行为不一致。

## 解法：一个自动发现的包装脚本

放到 `%USERPROFILE%\.codex\bin\codex-cli.cmd`（该目录通常已在用户 PATH 里）：

```bat
@echo off
setlocal EnableDelayedExpansion

set "TARGET="
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "Get-ChildItem -Path \"$env:LOCALAPPDATA\OpenAI\Codex\bin\" -Recurse -Filter codex.exe -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"`) do set "TARGET=%%F"

if not defined TARGET (
  for /f "delims=" %%N in ('where codex 2^>nul') do if not defined TARGET set "TARGET=%%N"
)

if not defined TARGET (
  echo [codex-cli] no bundled codex.exe and no global codex found >&2
  exit /b 127
)

"%TARGET%" %* < NUL
exit /b !ERRORLEVEL!
```

**要点：**

| 做法 | 为什么 |
|---|---|
| 每次运行时扫目录，取 **LastWriteTime 最新**的 `codex.exe` | 升级后哈希目录变了也不用改脚本 |
| 找不到就回退到 `where codex` | 桌面版没装也不会彻底失效 |
| `< NUL` 接住 stdin | CLI 会打印 `Reading additional input from stdin...` 并无终端时一直等；无 SSH/计划任务场景必加 |
| 保持脚本**纯 ASCII** | `.cmd` 在中文 Windows 下按 GBK 解析，UTF-8 中文注释会把后续行拆坏 |

**不要覆盖 `codex` 本身**——那是 npm 管的，`npm i -g` 一升级就把包装冲掉。

## 调用

```bat
codex-cli --version
codex-cli exec --dangerously-bypass-approvals-and-sandbox --cd "D:\path\to\repo" "任务描述"
```

## 实测（2026-11-08）

```
codex-cli --version        → codex-cli 0.167.0-alpha.3.2
桌面应用版本                → 26.1103.32239 (Nov 6, 2026)
npm 全局 codex             → 0.147.0（落后 20 个小版本，未动它）

任务一：只回复四个字         → 链路正常      6 秒
任务二：读 README 首行标题   → Workshop      9 秒（真的调了 pwsh 读文件）
```

## 三个踩过的坑

### ① 桌面版开着时，后台调用会卡住

桌面应用会占用自己的工作区/会话状态。后台再起一个同源进程容易僵住。
**做法：后台调用前先确认桌面版已退出。**

### ② `Reading additional input from stdin...` 不是卡死

它在等标准输入。SSH 非交互执行时没有 stdin，于是永远等下去。
**加 `< NUL` 即可**，进程会立刻结束。

### ③ 改 `config.toml` 不要用 `Set-Content -Encoding UTF8`

PowerShell 5.1 的 `-Encoding UTF8` **会写 BOM**，TOML 解析器不认；加上管道读写的编码推断，还会把中文路径截断：

```
改前  [projects.'...\桌面\公安厅低空经济']
改后  [projects.'...\桌面\公安厅低空经']
      → Error loading config.toml: unclosed table
```

**正确写法（逐字节保留，无 BOM）：**

```powershell
$p = "$env:USERPROFILE\.codex\config.toml"
$t = [IO.File]::ReadAllText($p, [Text.Encoding]::UTF8)
$enc = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($p, $t, $enc)
```

**动手前先备份，改完用行数 + 中文行存在性 + 废弃项清零三项校验。**

## 一并清理的废弃配置

`~/.codex/config.toml` 里这两项在新版被忽略，每次运行都刷警告：

```toml
disable_response_storage = true
preferred_auth_method = "apikey"
```

删掉即可，不影响功能。
