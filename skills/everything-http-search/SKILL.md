---
name: everything-http-search
description: Use when 秒级定位Windows硬盘文件。Everything开HTTP API跨会话查询。
version: 1.0.0
author: 蓝莓(Hermes)
license: MIT
metadata:
  hermes:
    tags: [everything, windows, file-search, ssh, session-isolation]
    related_skills: [self-hosted-kb, blocked-page-recovery]
---

# Everything HTTP 检索（Windows 秒级文件定位）

## When to Use

- 需要在 Windows 机器上快速定位文件（「这个文件在哪」）
- 从 SSH / 非交互会话调用桌面上的 Everything，遇到 `Error 8: Everything IPC not found`
- 文件量大（万级以上）、需要秒级召回，且不想为每个文件花算力和 Token 做向量化
- 需要把「找文件」能力分发给另一台机器上的 agent（笔记本 Codex/DSH 等）

**不适用**：需要读正文、跨文件推理的语义查询 —— 那是自建知识库（向量库）的活。

> **🤖 给智能体：这份文件是写给你照着做的工作手册，不是给人看的说明书。**
> 不要通读一遍就完事——先看下面「三条铁律」，然后按「已验证的检索任务清单」的顺序执行：
> 确认搜索能工作 → 定位 → 读正文 → 汇报。每条命令都可以直接抄，只改 `<...>` 占位符。
> 查询结果拿到手后先看 `totalResults`，再决定要不要加路径限定收窄。


## 三条铁律（先看这三条，再看细节）

```
① 不加盘符 = 搜全部已索引的盘
   用户没指定盘，别自己写 d: 缩小范围（实测 C 盘有 113 万条也可能有目标）

② 正则作用于「完整路径 + 文件名」
   加路径限定时必须写 regex:.*xxx 而不是 regex:xxx

③ 问「我有哪些 X」必须先搜目录
   只搜文件名会漏掉整个主题文件夹（9.53GB 的课程库就是这么漏的）
```

## 为什么用这个

Everything 直接读 NTFS MFT，全盘索引秒级建成，文件变动靠 USN 日志增量更新，**不花 Token、不耗算力**。

它只解决「文件在哪」；「文件写了什么」交给本地读取或向量库。

**适用边界**：80% 的场景是找文件 → Everything 就够；只有真要读内容/跨文件推理才动向量库。

**汇报风格**（此用户明确要求）：结论先行、先给数字、再给证据。不要长篇叙事，不要逐条贴结果。一句口径说明（怎么统计的）比多列二十行更重要。

## 已验证的检索任务清单（照这个顺序做）

| 问类型 | 做法 | 实测耗时 |
|---|---|---|
| 「这份文件在哪」 | 关键词，不加盘符 | 0.02s |
| 「我有哪些 X 资料」 | ①关键词→②`folder:`→③目录内枚举 | 0.05s |
| 「某项目全套材料」 | `path:"目录" !*.jpg !*.png` | 0.02s |
| 「最近变化」 | `dm:today` / `dm:7days`（`thisweek` 不可靠） | 0.02s |
| 「哪些项目/报价」 | 主题词 + `ext:xls;xlsx` | 0.02s |
| 「某年某月」 | `dm:2025-01-01..2025-12-31` 或 `regex:.*20\d{2}.?\d{1,2}.*` | 0.03s |
| 「这张证书」 | 搜主题词→定位→拷回原文件；PDF/扫描件用图片发 | 秒级 |
| 「批量统计」 | 搜→按 SR+Task 归并→按年/部件分组 | 秒级 |
| 「读内容」 | 定位后用 zipfile/pymupdf 直解 | 0.04s |

### 配套：自己的文件名索引（可选）

Everything 只管「全盘有什么」，不管「这批资料属于谁、哪个时期」。需要按业务分类时，建一张自己的文件目录表：

- `files(source_root, relpath, filename, filename_key, relpath_key, size_bytes, extension, mtime_ns, mtime_utc, absolute_path, absolute_path_key, sha256, tags)`
- `tags` 存**相对路径的每一层目录名**（`团队 / 厂商 / 案例 / 年份`），一眼就能看出归属
- 另建 `files_path_fts`（fts5 + `unicode61`，content=`files`，content_rowid=`id`）同时索引 `relpath` 和 `filename`
  ⇒ 只索引 filename 的话，搜「张三」查不到，因为人名在**目录名**不在文件名里
- 增量补齐：扫盘比对 `absolute_path_key`（小写绝对路径），只插新的；插完 `INSERT INTO files_fts(files_fts) VALUES('rebuild')`
- 必填列常不是你以为的那几个：`mtime_utc` 和 `tags` 都是 `NOT NULL`，缺一个就整批 `IntegrityError`

**分工**：Everything 负责「全盘、秒级、无需维护」；自建索引负责「业务分类 + 与知识库主键对齐」。

### ⚠️ 自建索引自己也会漏，别把「索引里没登记」当成「磁盘上没有」

实测磁盘扫到 52,362 个文件，索引只有 49,254 条 —— 差 3,162 个（新增文件、后建目录、扫盘被排除规则挡掉的）。

```
用户说「应该有」的词查索引 → 0 条
  ⇒ 先扫盘对账，别直接回答「没有」：
     绝对路径小写 not in 索引 → 批量插入 → rebuild files_path_fts
```

**人名/项目名往往在目录名不在文件名里**：搜人名时 `filename` 命中 0，必须同时索引并搜 `relpath`，或把路径每层目录名写进 `tags`。

**口径**：全盘工具覆盖全但只给文件名；自建索引带分类与正文关联但会漏。二者不是二选一 —— 前者管「定位」，后者管「分类 + 读内容」。

## 核心坑：跨会话 IPC 不通

Windows 会话隔离导致 SSH（session 0）调不到桌面（session 1）的 Everything：

```
es.exe → Error 8: Everything IPC not found
```

已实测无效的尝试：

- `Everything.exe -svc`（起后台服务，es.exe 仍报 Error 8，索引仍由 GUI 持有）
- 换安装版（ES.exe 官方要求仅为「Everything 必须安装并运行」，与跨会话无关）
- schtasks 桥接（能用但每次约 8 秒，且窗口闪烁）

**有效解法：开 HTTP Server。**

## 配置（一次性）

### 先装 Everything + ES（下载地址）

| 东西 | 下址 | 说明 |
|---|---|---|
| **Everything 便携版** | `https://www.voidtools.com/downloads/` → 找 `Everything-1.4.1.1032.x64.zip` | 解压即用，不装服务、不写注册表。**推荐这个** |
| **Everything 安装版** | 同上，`x64-Setup.exe` | 会装 Everything Service，但**不能解决跨会话问题** |
| **ES.exe（命令行）** | `https://www.voidtools.com/downloads/#cli` | 仅用于本地交互会话；跨会话用 HTTP 就别用它 |
| **SHA256 校验** | 下载页每条都带 `Everything-<ver>.sha256` | 下完先比对 |

**版本选择**：1.4.1.1030/1032 就够（正则+ HTTP 都内置）。1.5 Beta 把 HTTP Server、ETP Server 都改成了**独立插件**，装了还要单独下插件，**不值得升级**。

### 开 HTTP 服务（关键一步）

改 `Everything.ini`（与 `Everything.exe` 同目录）：

```ini
http_server_enabled=1
http_server_port=8089
http_server_bindings=127.0.0.1
allow_http_server=1
```

1. **先关掉 Everything** 再改 ini，否则退出时被内存里的旧值回写
2. 改前先备份：`Copy-Item Everything.ini Everything.ini.bak`
3. 绑定 `127.0.0.1` 只对本机开放；需要跨机访问才改成 `0.0.0.0`（注意安全）

也可以用图形界面（等价）：**工具 → 选项 → HTTP 服务器 → 勾“启用 HTTP 服务器” → 端口 8089 → 绑定 127.0.0.1**

### 开机自启 + 静默托盘（一劳永逸，推荐）

目标：**开机就自动起、端口就绪、桌面看不到窗口**。装一次，以后不用管。

#### ① 两个核心开关 + 一个 HTTP 开关（先关 Everything，改完再启）

```ini
run_in_background=1     ← 「界面→后台运行(B)」：点 × 不退出
show_tray_icon=1        ← 「界面→显示托盘图标(I)」：有图标才叫得出窗口
http_server_enabled=1   ← HTTP 服务（跟界面页无关，ini 里设置）
http_server_port=8089
http_server_bindings=127.0.0.1
```

**这三样齐了，点 × 就自动进托盘、HTTP 一直在、随时能用。** 不需要额外配 `minimize_to_tray`。

> **真正必须成对的只有两个，而且都在「界面」页里：**
>
> | ini 键 | 图形界面（工具 → 选项 → 界面） | 缺了会怎样 |
> |---|---|---|
> | `run_in_background=1` | **后台运行(B)** | 点 × **直接退出**，HTTP 服务跟着没 |
> | `show_tray_icon=1` | **显示托盘图标(I)** | 程序还在跑，**但没图标可点** → 人再也叫不出窗口 |
>
> 这两个勾上以后，点 × 会自动收到托盘（不需要另外的"最小化到托盘"选项——Everything 1.4 的
> 界面页里根本没有这一项）。HTTP 服务是 ini 里 `http_server_enabled=1` 控制的，跟界面页无关。
>
> **最坑的是「后台运行勾了、托盘图标没勾」**：程序确实在跑、HTTP 也通、agent 查得到，
> 但人手上完全看不见它——想改个设置、想手动搜一下，**没有任何入口**，
> 再双击 exe 还会报「进程已被占用」，只能去任务管理器杀进程。
>
> ⚠️ **更正**：早期版本本文写过 `minimize_to_tray=1` 要放进"一个不能少"的组合，那是错的——
> 界面页里没有这一项，`minimize_to_tray` 是 ini 里存在的键但不该当成配置步骤讲。
> `minimized=1` 只影响"启动时是否最小化"，可以用，但它不是防"退回后台"的开关。

### 开机自启：图形界面里没有这一项

Everything **界面的选项页里没有"开机启动"开关**（便携版尤其没有）。要开机自启，两条路：

**① 放启动文件夹（推荐，最直观）**

```powershell
$exe = "<Everything目录>\Everything.exe"
$lnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Everything.lnk"
$ws  = New-Object -ComObject WScript.Shell
$s   = $ws.CreateShortcut($lnk)
$s.TargetPath = $exe; $s.WorkingDirectory = Split-Path $exe
$s.Arguments = "-startup"
$s.WindowStyle = 7
$s.Save()
```

**② 装成服务的安装版**：安装版在 `工具 → 选项 → 常规` 里有"随 Windows 启动"，便携版没有。

> 想确认到底起没起：`Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"`

#### ⚠️ 配完这两项，最容易撞上的「进程被占用」

**症状**：勾了「后台运行」但没勾「显示托盘图标」→ 点了 × 之后程序**看不见但还在跑**。
然后去双击 `Everything.exe` 想重新打开，弹「**进程已被占用**」——想改设置都没入口。

**根因**：旧实例还占着单实例锁，新实例起不来，而旧实例又没有 UI 可以点。

**三步修复（不需要重启机器）：**

```powershell
# ① 杀掉所有残留实例（这一步解决"被占用"）
Get-Process Everything -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
(Get-Process Everything -ErrorAction SilentlyContinue | Measure-Object).Count   # 应为 0

# ② 改 ini 四键（先关程序再改，否则退出时会回写旧值）
$ini = "<Everything目录>\Everything.ini"
Copy-Item $ini "$ini.bak" -Force
$t = Get-Content $ini -Encoding UTF8
$t = $t -replace '^show_tray_icon=0$',     'show_tray_icon=1'
$t = $t -replace '^run_in_background=0$',  'run_in_background=1'
$t = $t -replace '^http_server_enabled=0$','http_server_enabled=1'
$t | Set-Content $ini -Encoding UTF8

# ③ 重新启动
Start-Process "<Everything目录>\Everything.exe" -ArgumentList "-startup","-minimized"
```

**关键顺序：先杀进程 → 再改 ini → 再启动。** 顺序反了会被回写覆盖，等于白改。

**验证**：`Get-Process Everything` 有进程、`MainWindowHandle=0`、8089 监听 1 条、
托盘区能看见图标、右键图标能呼出窗口。


配套已有的 `http_server_enabled=1` / `http_server_port=8089` / `http_server_bindings=127.0.0.1`。

#### ② 在启动文件夹放个快捷方式（比 schtasks 更适合开机自启）

```powershell
$exe = "C:\path\Everything.exe"
$lnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Everything.lnk"
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnk)
$s.TargetPath = $exe
$s.WorkingDirectory = Split-Path $exe
$s.Arguments = "-startup -minimized"   # ← 关键是 -minimized
$s.WindowStyle = 7                     # 最小化窗口
$s.Save()
```

> **为什么用启动文件夹而不是 schtasks**：schtasks 的 `/sc ONLOGON` 也能自启，但启动文件夹更直观、用户能在"启动"里看见、出问题好排查。`/it` 那个用法只适合**临时**从 SSH 拉起来，不适合常驻。

#### ③ 验证（重启后）

```powershell
Get-Process Everything                                    # 有进程
Get-NetTCPConnection -LocalPort 8089 -State Listen        # 1 条
(Get-Process Everything).MainWindowHandle                 # 0 = 无窗口，在托盘
(Get-Content Everything.ini) | Select-String "run_in_background=1"   # 1 = 点×不退出
Invoke-WebRequest "http://127.0.0.1:8089/?search=test&json=1" -UseBasicParsing  # 200
```

**实测**：重启后 **1–4 分钟**就绪（热重启约 1.5 分钟，智能插座冷启动约 4 分钟，视磁盘和负载而定）；`MainWindowHandle=0`（真静默），8089 可查。

### 临时拉起（SSH 场景）

已经开机自启了就不用这段。只有在 Everything 被误退出、而你又不在那台机器前时才用：

```powershell
schtasks /create /tn "ACP-Start-Everything" /tr "\"C:\path\Everything.exe\" -startup -minimized" /sc once /st 23:59 /f /it
schtasks /run /tn "ACP-Start-Everything"
```

普通 `Start-Process` 启的进程会被 SSH 断连带走。

### ⚠️ 托盘类配置的坑（实测踩过）

**改了 `tray_event` 这种托盘相关配置后，不要从 SSH 重启程序。**

Windows 的 SSH 会话处在隔离的 session 里，**建不出系统托盘图标**，程序会直接退出。日志特征：

```
ERROR [[Tray]] tray icon error: 未指定的错误 (os error -2147467259)
```

`-2147467259` 就是 `E_FAIL`。同理适用于 Clash Verge 这类常驻托盘的软件——它们的托盘行为只能在图形界面里改，改完让用户自己点图标启动。

## 查询接口

```
GET http://127.0.0.1:8089/?search=<urlencode(关键词)>&json=1&count=20&path_column=1
```

返回 UTF-8 JSON，**默认只给 name 不给 path**。参数：

```
&path_column=1       带 path 字段（实测有效！）
&full_path=1         实测无效，不会多出字段
&size=1              文件大小
&date_modified=1     修改时间
&path=D:\项目资料    限定目录（先 urlencode）
&a-d                 只要文件（/ad 只要目录）
```

**要路径就加 `path_column=1`；`full_path=1` 是陷阱，加了也没 path。**

**中文关键词必须 URL 编码**，不要走命令行参数（schtasks/cmd 多层转义会吃掉中文）。

### 结果处理

- 同一文件会被命中多次（同时出现在多个父目录、大小写不同、同步副本）→ 用 `name + path` 去重
- `path` 字段是父目录，完整路径要自己拼 `path + "\\" + name`
- 终端显示「æ¢¦ç½」不一定是真乱码：Python 里 `r.read().decode("utf-8")` 通常正常，PowerShell `Invoke-WebRequest` 会显示错 → 用 Python 取

### 排除自己造成的副本（不排除就没法用）

任何在盘上做过「拷贝/转换/建库」的机器，同一批文件都会有 2–4 份副本，结果列表会被副本淹没。查询时**默认带上排除**：

```
!ACP-Shared !KB-Vectorization !03-converted !*副本* !~* !*.lnk
```

对应四类污染源：

| 干扰源 | 表现 | 处理 |
|---|---|---|
| `01-source` 补捞包 | 和第①②批原件同名同路径尾 | `!ACP-Shared` |
| `KB-Vectorization\packages\...\source` | 建库时的源快照 | `!KB-Vectorization` |
| `03-converted` | LibreOffice 转换产物 | `!03-converted` |
| `vault_bak*` / `AppData\...\Recent` | Obsidian 备份、`.lnk` 快捷方式 | `!vault_bak*` `!*.lnk` |

**判据**：某个主题命中数忽然到几百，而你以为只有几十份 —— 一定是副本。先加排除再看，否则会把「重复」误报成「资料很多」。

**路径限定比排除更省事**：已知资料归属某个根（`D:\项目资料`、`D:\历史工单`），直接 `"D:\项目资料\" 主题词`，副本自然被挡在外面。

## 语法速查（转给其他 agent 照做即可）

### 【默认规则】不加盘符 = 搜全部已索引的盘

**用户问「我电脑上有没有 X」，不要自己限定 `d:`。**

Everything 索引的不止 C/D：实测 `ntfs_volume_paths` 里有 `C:`、`D:` 和一堆 `E:`（可移动卷/U盘/虚拟盘），共 27 个卷。只写 `d: 麻将` 会漏掉 C 盘和一切外接盘。

```
✅ 麻将                     全盘（所有已索引的 NTFS 卷）
✅ C: 麻将                  只查 C 盘
✅ C:|D:|E: 麻将            指定多个盘
❌ d: 麻将                  用户没指定盘时，自己缩范围 = 漏查
```

**什么时候才限定盘符：**

- 用户明确说了「在 D 盘」「在我的文档里」
- 已通过目录排查确认资料归属某个根（`D:\项目资料`）

**判断「Everything 到底覆盖了哪些盘」：**

```
读 Everything.ini 的这三行，长度应一致：
  ntfs_volume_paths="C:","D:","E:",...      ← 实际盘符
  ntfs_volume_includes=1,1,1,...            ← 1=纳入索引
  ntfs_volume_roots="","",...               ← 可选的根限制
```

或用 HTTP 探：`C: ` / `D: ` / `E: ` 各自带空关键词查一次，返回 0 的就是没这个盘或没索引。

两个前缀最重要：`regex:` 和 `content:`；再加路径/扩展名限定就够了。

### 基础搜索语法（Everything 1.4 内置）

```
abc            文件名含 abc
a b            AND
"a b"          精确短语
a|b            OR
!a             NOT
a*             前缀
*.a            扩展名
[a-z]          字符范围
size:>1mb      大小
size:10mb..50mb  大小区间
dm:today       修改日期
date:today     创建日期
attrib:H       属性（H隐藏/S系统/D目录）
content:关键词  搜内容（需 IFilter）
```

### 正则表达式语法（Everything 1.4 完整支持，实测通过）

```
a|b          匹配 a 或 b
gr(a|e)y     匹配 gray 或 grey
.            匹配任一字符
[abc]        匹配 a 或 b 或 c
[^abc]       匹配除 a,b,c 外的任一字符
[a-z]        匹配 a 到 z
[a-zA-Z]     匹配 a-z 及 A-Z
^            匹配文件名开头
$            匹配文件名结尾
( )          捕获组
\1..\9       引用第 n 个捕获组
\b           词边界
*            前项 0 或多次
?            前项 0 或 1 次
+            前项 1 或多次
*?  +?       懒人模式
{x}          前项恰 x 次
{x,}         前项 >= x 次
{x,y}        前项 x 到 y 次
\            特殊字符转义
```

写法：`regex:模式`，可与普通词、路径、属性前缀叠加。

### ⚠️ 最重要的坑：正则作用于「完整路径 + 文件名」

```
❌ "D:\项目资料\" regex:汇报.*\.pptx$      → 0 命中（路径开头是 D:，永远对不上）
✅ "D:\项目资料\" regex:.*汇报.*\.pptx$     → 82 命中
```

加路径限定时，正则前面必须加 `.*` 把路径吃掉。`^` 在带路径限定时等于匹配盘符，不是文件名开头。
（实测：单个 regex 的两种写法拿到的命中数完全一致，说明 `regex` 丢的是整条全路径。）

### 正则 vs 关键词：能用关键词就别用正则

实测对比（同一意图，都是 82 命中、0.03 秒）：

```
"D:\项目资料\" regex:.*汇报.*\.pptx$ dm:>2024     → 82
"D:\项目资料\" 汇报 ext:pptx dm:>2024            → 82   ← 更好写
```

**正则只在下面三种情况才值得用：**

```
① 要匹配固定格式（SR号格式、日期格式、版本号）
② 要精确限定文件名首/尾
③ 要排除特定模式
```

### 目录限定的两套写法（实测都通）

```
path:"D:\项目资料\...\某项目(2025.12)"      → 59 条
"D:\...\项目名(2025.12)\"                 → 58 条（结尾 \ 表示只要该目录）
path:项目名 dm:>2025                       → 12 条（只按路径关键词）
```

**坑**：目录名带半角括号 `(2025.12)` 时，用 `path:"..."` 比直接把整个字符串当词项稳。

### 六个实用组合（已实测，都是 0.0x 秒）

```
# ① 2024年后改过、大于20MB的PDF方案
"D:\项目资料\" regex:.*方案.*\.pdf$ size:>20mb dm:>2024      → 5 条

# ② 所有中标/成交通知类文档
<中标|成交> ext:doc;docx;pdf;xlsx                          → 51 条

# ③ 某厂商 2012 年全部 Case（目录级别）
"D:\历史工单\案例\2012\" folder:                      → 689 个

# ④ 某年区间 + 主题
dm:2025-01-01..2025-12-31 ext:docx regex:.*立项.*          → 6 条

# ⑤ 统一命名的服务报告（SR号 空格 Task号 开头）
path:"D:\历史工单\服务报告\" regex:.*^\d+\s\d+\s.*  → 1965 条

# ⑥ 带版本号的文档（版本管理/多版本共存审查）
"D:\项目资料\" regex:.*V\d+.*\.docx$ dm:>2025                → 59 条
```

### 三条必踩的坑（实测）

1. **点号必须转义**。`2022.` 中 `.` 会匹配任意字符，误命中 `2022年` `2022-`；写 `2022\.`。
2. **不要用嵌套复杂分组**。`(20\d{2})[.\-年](0?[1-9]|1[0-2])` 实测 0 命中；改写为 `20\d\d.\d\d` 即可。
3. **方括号内的连字符**。`[.\-年]` 不稳；用 `[\/\.\-年]` 这种显式列举。
4. **`$` 锚点 + 扩展名分组会静默失败**。`regex:中标通知书\.(pdf|docx?)$` 实测 0 命中，而同名文件确实存在。要定位「以某词结尾的文档」，改用扩展名前缀 + 普通主题词分离匹配：`中标通知书 ext:pdf;doc`，别在一条 regex 里同时赌 `$` 和分组。
5. **正则和通配符不要混在同一个词项里**。一条查询里写了 `regex:`，同词项的 `*` 会被当正则量词；要限定扩展名就另起一个 `ext:` 词项。

### 两个关键例子（其他 agent 照抄即可）

**例 1：找服务报告里的所有更换记录**

```
path:服务报告 replace <部件> *.tif
```

命中 4 条，每条文件名自带 SR 号、Task 号、客户名。同理 `Check BBU` 得 2 条。

**例 2：找某主题下带日期的报价表**

```
d: 云桌面 ext:xls;xlsx;xlsm regex:报价
```

只要把 `某主题词` 换成任意业务词（项目名、厂商名、设备名……），套路完全一样。

### 通用套路（任何需求都能套）

```
<盘符或路径限定> <主题词> <扩展名限定> <可选的 regex/content>
```

例如：

```
d: 主题词 ext:doc;docx;pdf       主题相关文档（排掉图片）
path:服务报告 regex:.*^\d{7,8}      厂商目录下数字开头的 Case（注意 .* 前缀）
regex:.*20\d{2}.?\d{1,2}.*\.docx$ 全盘文件名带年月的 Word
```

### ⚠️ 关键词搜索会漏掉「目录式收藏」（必读）
**只按文件名搜会漏掉整夹东西。** 实测：问「我有哪些某某品牌资料」，按 `<品牌名>` 搜出 400 条，但真正的主力 `D:\职业认证\`（33 个文件 / 9.53 GB，某认证全套课程）**一条都没出现** —— 因为里面是 `模块A.zip` `模块B.zip` `模块C.zip` `模块D.zip`，文件名根本不含品牌名。

**所以问「我有哪些 X 资料」时，必须三步都过：**

```
① 关键词搜       <X|中文别名>                    找文件名带 X 的
② 目录搜         path:X folder:                  找名字叫 X 的文件夹
③ 目录内枚举     "D:\项目资料\X\"                 把整个文件夹里的东西全列出来
```

**目录批量的实战例子**：`D:\职业认证\` 下 33 个文件 / 9.53 GB，按子目录分类报给用户（子目录 A 20 个 / 子目录 B 6 个 / 根目录书籍 5 个）；统计时用 `os.walk` 统计每组文件数 + 字节数，比逐条列文件名有用。

**特别提醒**：很多人的收藏习惯是「建一个主题文件夹，里面放一堆通用命名的文件」。只搜文件名会得到“我这里没有”的错误结论。**先搜目录，再搜文件。**

### 重复副本：结果里往往只有不到一半是真文件

实测 400 条结果里，大部分是同一批文件的 3–4 份拷贝。常见重复源（按优先级排除）：

```
!ACP-Shared                       同步共享区的副本
!KB-Vectorization                 建库时拷的 source 副本
!03-converted                     老格式转换产物
!.lnk                             Windows 快捷方式
!KB-老资料* !KB-新质*             知识库工作目录
!*副本* !~$*                      手工副本与 Office 临时文件
```

推荐默认带上的“去噪尾巴”：

```
!KB-* !ACP-Shared !KB-Vectorization !03-converted !*.lnk !~$*
```

**去重手法**：先 `name+path` 去重，再按 `path` 前缀归组；同一个 `name` 出现在多个根目录 = 副本。

## 用法：先搜目录，再搜文件，最后读正文

### 第 0 步：先确认搜索本身能工作（每次都做）

用户说「应该有」而搜出 0 条时，**先用一个已知必能命中的词验证管道**，再下结论：

```
搜「足球」 → 8 条   ✅ 中文搜正常
搜「证书」 → 100 条 ✅
搜「麻将」 → 0 条
⇒ 才可以说「确实没有」，而不是猜测
```

**⇒ 分盘统计要逐个打 `C: ` / `D: ` 空查询，不要假设 Everything 只索引了 D 盘。** 用户纠正过：「搜索是所有的盘符都要搜」——他问「有没有 X」时，答案必须是全盘口径。

**⇒ 说「确实没有」时必须同时报覆盖范围**（例：`C: 1,135,244 条 / D: 214,631 条，四个盘都查了，关键词 0 命中`）。只报「搜不到」用户分不清是搜过了还是根本没搜。

否则会把「查询语法写错」误报成「文件不存在」。

### 第 1 步：定位（不加盘符）

见上方「三条铁律」与「默认规则」。

### 第 2 步：命中后直接读正文（不要叫人双击）

详见下方「配合读正文」。OOXML 本质是 ZIP + XML，用 `zipfile` 直接解，**0.04 秒读完 28 段**。

### 第 3 步：批量统计，不要一条条报

用户问「我换了多少块硬盘 / 有多少项目」时，不是列清单，而是统计：

```
① 按 SR号 + Task号 归并（一次工单可能留多份文档）
   re.match(r"(\d{6,9})\s+(\d{6,9})", filename)
≠ 文件数，而是工单数
② 按年份分组：从路径里的 (20\d\d) 取
③ 区分「更换」与「检查」：replace vs Check
④ 区分部件：replace disk / SPS / PS / BBU / LCC / Disk Bay
   ⇒ 这才能看出「主要坏的是哪类部件」
```

**实测参考值**（十年期服务报告，约两千个工单）：换盘 509 次、换电源 227 次、LCC 9、BBU 4、盘框 4 —— 硬盘+电源占 97%，符合存储硬件寿命规律。

### 结果汇报：先给数，再给证据

```
✅ 「509 次」+ 一句口径说明（按 SR+Task 归并，含 32 次多盘工单）
❌ 列 500 个文件名
```

要让用户能判断可信度（口径、样本、时间范围），而不是堆细节。

## 最小可用脚本（Python，跑在 Windows）

```python
import urllib.request, urllib.parse, json

def es_search(q, n=20, path=None):
    p = {"search": q, "json": "1", "count": str(n), "path_column": "1", "a-d": ""}
    if path: p["path"] = path
    url = "http://127.0.0.1:8089/?" + urllib.parse.urlencode(p)
    with urllib.request.urlopen(url, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))

# 用：命中后拼完整路径，再去重
# for x in es_search("云桌面 ext:xlsx")["results"]:
#     full = (x.get("path") or "") + "\\" + (x.get("name") or "")
```

实测 0.02–0.6 秒，比 schtasks 桥接快几百倍。

## 配合读正文（定位后直接开）

命中后不要叫人去双击打开，直接本地解析，实测 OOXML 只要 0.0x 秒：

| 格式 | 怎么读 | 备注 |
|---|---|---|
| `.docx` | `zipfile` 取 `word/document.xml`，按 `<w:p>` 切段、`<w:t>` 取字 | 0.04 秒读完 28 段 |
| `.xlsx` | `zipfile` 取 `xl/sharedStrings.xml` + `xl/worksheets/sheetN.xml` | 无 openpyxl 时照样能读 |
| `.pptx` | `zipfile` 取 `ppt/slides/slideN.xml` | |
| `.txt/.md/.csv` | 直接按编码读（utf-8 → gbk → latin-1 依次试） | |
| `.pdf` | pymupdf | 无文字层→只登记文件名，不 OCR |
| `.doc/.xls/.ppt` | LibreOffice 转 OOXML 再抽 | Office COM 慢、易崩、且会改写文件 SHA |

**xlsx 两个必踩细节**：`t="s"` 的 `<v>` 是共享字符串下标，数字单元格直接是值不查 sharedStrings；`<row>` 里列的字母不保证连续，拼表时要处理空列。

**为什么能直接读**：OOXML 本质是 ZIP 包，正文就是 XML 文本；老格式（.doc/.xls/.ppt）是二进制复合文档，读不了。

### 从表格里取「今天上什么课」这类结构化答案

xlsx 网格先用 `sharedStrings` 还原成「列字母 → 文本」，再按表头（星期几在哪几列）取当天那一列。不要按行的自然顺序猜 —— 课表类表格常是「时间在 C 列、星期在 D–H 列」。

## 版本与升级

| 版本 | 正则 | HTTP Server | 备注 |
|---|---|---|---|
| 1.4.1.1030 | ✅ 完整 PCRE 风格 | ✅ **内置** | 通配符 + 属性函数 + 正则都齐，无需升级 |
| 1.4.1.1032 | ✅ | ✅ 内置 | 1.4 分支最新小更新（含 Portable ZIP） |
| 1.5.0.1424b | ✅ | ❌ **改成了插件** | HTTP/ETP 都不在程序里，要去官网 plugins 页单独下 |

**⇒ 结论：1.4 完全够用，不要为了「拿正则」去升 1.5。** 升了反而要多装 HTTP 插件才能保住跨会话检索这条路。

**升级便携版要点**（如果真升）：

1. 从 `voidtools.com/downloads/` 拿 zip，用官网 `Everything-<ver>.sha256` 比对 SHA256（下载页每条都带校验值）
2. 解压到**新目录**（如 `...\Everything15`），不要覆盖旧目录 —— 出问题直接切回
3. **1.5 便携版首次启动会停在「首次运行向导」等用户点确认，后台 schtasks 启动没人点就卡着不动**（内存 ~22MB、CPU 0s、不生成 ini/db、不监端口）。升级需要有人在场点一下，或先手写 ini 再启动
4. 1.5 的 ini 格式与 1.4 不完全兼容，建议只迁移 HTTP 那几行，不要整体覆盖

## 先拿 Everything 当对照基准（升级/补漏前的硬验证）

判断自建索引「够不够用」的标准是用户定的：**Everything 搜得到的，我们必须搜得到**。验证方法：

```
① 导出全量清单（一次就够，比查数据库省事）
   es.exe -path "D:\" -export-csv out.csv      # 需在桌面会话跑，或用 HTTP 逐关键词比
② 逐关键词两边各搜一遍，比命中集合
③ 只补「它有我没有」的部分；不要反向用自建索引去减 Everything
```

**预期差距**：Everything 的 21 万条里含目录，自建索引只收文件 —— 直接比总数会吓人。先 `a-d`（只要文件）再比，或按扩展名分桶比。

## 部署到多台机器

笔记本 Win11 同样适用：装 Everything → 改 ini → 开 HTTP → 起服务。之后笔记本上的 Codex/DSH 用同一套 HTTP 调用即可，无需 schtasks 桥接。

## 验收标准

搜一个中文关键词，返回结果里中文正常（不是 `æ¢¦ç½`）、0.5 秒内返回、`path` 字段非空（记得带 `path_column=1`）。

**⇒ 报「没有」前先做反证**：换一个已知必然命中的词跑同一条查询路径，能出结果才说明管道是通的。

```
搜「足球」→ 8 条、搜「证书」→ 100 条  ⇒ 中文检索管道正常
此时「麻将」→ 0 条才敢说「全盘确实没有」
```

**⇒ 结论必须带覆盖数字**（例：`C: 1,135,244 条 / D: 214,631 条 / E: 0 / F: 0，四盘全查，关键词 0 命中`）。只回一句「搜不到」，用户分不清是查过了还是压根没查——他对「只搜了 D 盘」会立刻纠正。

## 跨平台边界（写进对外文档时的硬约束）

用户要求文档里明确写死这一点：**本技能全部依赖 NTFS MFT 与 Everything，Windows 专有。** Linux / macOS 是另一套做法，不可类比：

```
Windows  → Everything HTTP（常驻索引 + USN 增量，秒级）
Linux    → fd / rg --files（找名）、rg -l / grep -r（找内容）、可选 plocate/mlocate 先建索引
macOS    → mdfind（Spotlight 索引）
```

**⇒ 派活话术不能混用**：Linux 的 `rg` 默认作用域是**文件内容**，找文件名要 `fd` 或 `rg --files | rg`；语法相似不等于语义相同，这是最容易静默出错的地方。

**⇒ 对「非 UI、纯命令行/HTTP」这件事的解释口径**：用户要的是「不点界面、直接给接口」，Windows 上就是用 HTTP Server 把它变成可 curl 的普通服务，而不是写自动化点按钮。对外文档照这个说法写。

## 与向量库的分工（别混用）

| 需求 | 用什么 | 为什么 |
|---|---|---|
| 「这份文件在哪」 | Everything | 秒级、零 Token、全盘覆盖、永不过期 |
| 「某个项目有哪些材料/报价」 | Everything + `ext:` 过滤 + 目录分组 | 字面匹配不会被泛词带偏 |
| 「这份文件写了什么」 | 直接读文件 | 定位后本地解析最快 |
| 「跨文件推理/汇总」 | 向量库 + 本地小模型 | 只有这类才值得抽取/切块/向量化 |
| 「换了多少次 / 哪个月最多」 | Everything 列表 + 脚本归并统计 | 数字是我们数出来的，库里没有这个结论 |

**⚠️ 面向非 Windows 平台先划边界（用户明确要求写进文档）：** 本技能全部依赖 NTFS MFT 与 Everything，Windows 专有。Linux / macOS 上对照物是 `find` + `grep -r` + `mdfind`（macOS 用 Spotlight 索引），或自建文件目录表。两类平台的能力不对等：Everything 是 **常驻索引 + 秒级增量**，`find`/`grep` 每次都要现扫盘，GB 级目录会从秒级跌到分钟级。派活前先问三句：

```
① 哪个平台？（Windows → Everything；Linux → fd/rg + 可选 plocate/mlocate；macOS → mdfind）
② 盘多大？超过几百 GB 就先用 locate 类工具建一次索引，别裸跑 find
③ 要文件名还是正文？（正文 → rg -l / grep -r，并先限定扩展名，否则扫 .git/node_modules 会卡死）
```

**⇒ 给别的 agent 派活时不要把 Windows 的路径写法和 `regex:` 语法硬套过去**：Linux 的 `rg` 用 PCRE 但作用域默认是**文件内容**，找文件名要用 `fd <pattern>` 或 `rg --files | rg`。语法相似不等于语义相同，这是最容易静默出错的地方。

**教训**：把整个硬盘几万份文件都吃进向量库是错的。用向量库问「云桌面有哪些项目」，会被「项目」「方案」这类泛词带到无关文档上；用 `d: 云桌面 ext:xls;xlsx` 反而 0.02 秒给出全部报价表。**只对真正要读内容的核心资料做向量化。**

同一个教训的反面：**「手写/扫描件只登记文件名」不是偷懒，是有意为之**。十多年前的服务报告、手写工单扫描件，OCR 识别率低、算力与 Token 成本高，而文件名本身已带 Case 号 + 动作 + 客户，**看一眼文件名就够回答「做过什么」**。这类资料只入索引、不入向量库，也不算「漏做」。
