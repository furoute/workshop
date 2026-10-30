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

#### 一次配好，开机就能用

```ini
run_in_background=1       # 界面→后台运行(B)：点 × 不退出
show_tray_icon=1          # 界面→显示托盘图标(I)：有图标才叫得出窗口
http_server_enabled=1     # HTTP 服务（ini 里设）
http_server_port=8089
http_server_bindings=127.0.0.1
```

开机自启：**启动文件夹放快捷方式**（`%APPDATA%\Microsoft\Windows\Start\Menu\Programs\Startup\Everything.lnk`，
参数 `-startup`）。图形界面里没有这个选项。

**托盘配置坑**：从 SSH 启的进程在隔离 session 里建不出托盘图标，会直接退出
（`tray icon error: os error -2147467259`）。

⇒ **完整命令、三步修复「进程被占用」、验证清单：[`references/install.md`](references/install.md)**

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

## 📚 参考资料（`references/`）

| 文件 | 内容 | 什么时候看 |
|---|---|---|
| [search-syntax.md](references/search-syntax.md) | 完整语法字典：基础 / 操作符 / 通配符 / 宏 / 修饰符 / 57 个函数 / 大小与日期 / 属性常数 / 实战组合 | 想到新写法、不确定某个函数 |
| [command-line.md](references/command-line.md) | 命令行 129 条（按用途分组）+ 常用组合 | 要写启动参数、装服务、导索引 |
| [regex.md](references/regex.md) | 完整元字符表 + 实测通过 / 实测失败清单 + 何时该用 | 正则没命中时先查这里 |
| [install.md](references/install.md) | ini 四键 / 启动文件夹 / 三步修复「进程被占用」/ 验证清单 | 新机器部署、程序挂了 |
| [pitfalls.md](references/pitfalls.md) | 四类污染源、重复文件去重实测 | 结果里全是副本 |

> **给任何 agent**：本文是速查，遇到没见过的语法/参数先去上面查，别凭印象写。
> 五个文件都是纯 Markdown，可以直接 grep。

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

### 排除自己造成的副本

降权常见污染源：`KB-*`（知识库副本）、`03-converted/`（格式转换产物）、
`~$*`（Office 锁文件）、`.lnk`（快捷方式）。**不排除就没法用**——结果里一半是副本。
⇒ **四类污染源的完整对照 + 去重实测：[`references/pitfalls.md`](references/pitfalls.md)**

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
