# WinShun vs Everything：给智能体的选型与实测

> 同一台 Windows 上装两个文件检索工具，用同一个 agent 调、同一批查询比。
> 结论先给：**找文件名两者打平；搜文件内容、拼音搜索，只有 WinShun 能做；全盘覆盖，Everything 更强。**
>
> 实测环境：i7-8700 / 32 GB / Windows 11｜WinShun 0.33.0 便携版｜Everything（HTTP 8089）

---

## 一、横评总表

| 维度 | Everything | WinShun |
|---|---|---|
| **索引规模** | 全部 NTFS 卷，实测 **133 万+** 文件 | 手动指定目录，实测 **29.5 万** 项 |
| **索引实时性** | 读 NTFS **USN 变更日志**，秒级 | 同样读 MFT + USN，秒级 |
| **新增文件** | 全自动，无需干预 | 全自动，无需干预（但**新增目录要手配一次**） |
| **文件名搜索** | 0.016–0.042 s | 0.016–0.032 s |
| **拼音 / 首字母** | ❌ | ✅ `msxz` → 某部电影名 |
| **搜文件正文** | ❌ | ✅ `ws grep`（临时扫，索引建好后走索引） |
| **读 docx/xlsx/pptx/pdf 正文** | ❌ | ✅ `ws text` |
| **机器可读输出** | ✅ `json=1` | ✅ `--json` |
| **调用方式** | HTTP API `:8089`（纯文本/JSON） | 命令行 `ws.exe` + MCP 服务 |
| **工作集内存** | **210 MB**（2 进程） | **59 MB**（1 进程） |
| **私有内存** | 162 MB | 237 MB |
| **线程数** | 25 | 178（Qt6） |
| **安装部署** | 装完即用，自动索引全盘 | 要配搜索范围；便携版解压即用 |
| **额外能力** | 无 | 剪贴板历史、OCR、插件、截图、MCP |
| **适用** | 人敲界面找文件、agent 全盘定位 | agent 搜内容、拼音检索、读文档 |

---

## 二、同一批查询，两边对照

| 查询 | Everything | WinShun | 结论 |
|---|---|---|---|
| 中文片名 | 8 条 / 0.042 s | 5 条 / **0.016 s** | WinShun 更快 |
| 同名前缀（拼音首字母 `msxz`） | 搜不出 | ✅ 命中 | **WinShun 独有** |
| 特定扩展名 `*.mkv` | 支持 | 1 条 / 0.03 s | 打平 |
| 文档正文里的词 | ❌ 不支持 | ✅ 命中行 + 行号 + 路径 | **WinShun 独有** |
| 日期串（纯数字） | 61 条 | **0 条** | **⚠️ WinShun 短板** |
| 目录列表（263 个文件） | 需按路径过滤 | `ws ls` 秒出 | WinShun 更顺手 |

### 内容搜索实测（关键能力）

```bash
ws grep "导演名" --in <视频目录>
→ 0.03 s
→ D:\...\某电影\某电影.txt:7:导演: 某某某
```

**⇒ 直接给「文件路径 + 第几行 + 命中原文」，不用打开文件、不用先知道文件名。**

**⇒ 这是 Everything 完全做不到的。**

**⇒ 但前提是那个目录已建有内容索引；否则是临时扫盘，大目录会超时（默认 5 s 上限，可 `--timeout 30s`）。**

### ⚠️ WinShun 的一个真实短板

```
纯日期串（形如 20261113）：
  Everything  → 61 条
  WinShun     → 0 条
```

**⇒ 大量文件用日期命名时，按日期搜会漏。**

**⇒ 规避：带扩展名 `--ext json`，或改用 `ws grep` 搜内容。**

---

## 三、从智能体视角：谁做什么，哪里必须人上

这是本文最要紧的一节。**把「agent 能自动做的」和「必须人工介入的」分清楚，才不会卡在中途。**

### 3.1 必须人工介入（agent 做不了）

| 事项 | 为什么 |
|---|---|
| **首次安装** | Windows 未签名提示「已保护你的电脑」→ 要人点「更多信息 → 仍要运行」 |
| **首次启动向导** | 它卡在 `onboardingWindow`，日志报「Could not bring the window to the front」。**SSH 会话（session 0）里根本弹不出来**，必须人坐在机器前点一遍，或由人确认后 agent 用 `schtasks /it` 投到会话 1 |
| **配置搜索范围（第一次）** | 默认只索引用户目录。加 D 盘等目录**要人点一次**（或 agent 改 `WinShun.ini` 后重启，见 3.2，但这是改配置，按纪律要先问） |
| **打开「允许命令行连接」** | 默认关闭，`ws` 直接报错。可改配置（`[Mcp] Enabled=true`）但要重启 |
| **界面上出现的任何确认弹窗** | 插件装权限、AI 改设置、截屏申请，都会弹窗等人点 |

> **一句话：安装 + 首启向导 + 第一次配范围，这三步人必须在场。之后就全自动了。**

### 3.2 agent 能自动做的

| 事项 | 怎么做 |
|---|---|
| 改索引范围 | 改 `WinShun.ini` 的 `[Index] Folders=`，然后 `taskkill /IM WinShun.exe /F` + `schtasks /run` 重启（**改配置前须征得用户同意**） |
| 开启命令行接口 | 同上，改 `[Mcp] Enabled=true` |
| 重启进程到交互会话 | `schtasks /create /tn <名> /tr "<exe>" /sc once /st 23:59 /it /f` 然后 `/run` |
| 所有检索 | `ws find` / `ws grep` / `ws text` / `ws ls` / `ws recent` |
| 判断索引是否就绪 | `ws status`（返回「就绪，N 项」） |
| 新增文件自动进索引 | **不用管**，USN 日志自己跟上 |
| 插件管理 | `ws plugin list / search / install / enable` |

### 3.3 一句话判断

```
能跑命令 → agent 全能干
要弹窗   → 人得来
改配置   → agent 能干，但要先问
```

---

## 四、安装与配置（一次搞定，之后不用再管）

### 4.1 下载

```bash
# 官方 release，取便携版（不写注册表）
gh release download <最新tag> -R LingCore/WinShun -p 'WinShun-*-portable.zip'
```

**⇒ 便携版约 43 MB，解压即用，数据都在旁边的 `data\` 里，删文件夹即卸载。**

### 4.2 首次启动

```
① 解压到任意目录（如 D:\LLM\WinShun\）
② 双击 WinShun.exe
③ Windows 提示「已保护你的电脑」→ 更多信息 → 仍要运行
④ 首启向导：选搜索范围 / 剪贴板历史开关 / 唤醒快捷键 → 开始使用
```

**⇒ 这一步必须人在机器前操作。**

### 4.3 打开命令行接口（agent 用的前提）

**⇒ 界面：设置 → AI 助手 → 权限 → 启用命令行**

**⇒ 或改配置：`data\WinShun\WinShun.ini` 里 `[Mcp]` 段的 `Enabled=true`，改完重启进程。**

**⇒ 验证：**

```bash
ws status
# Win顺 x.x.x：在运行
# 索引：就绪，N 项
```

### 4.4 加搜索范围（D 盘等）

**⇒ 界面：设置 → 搜索范围 → 添加文件夹**

**⇒ 建议只加具体目录，别整盘：**

```
D:\ACP-Shared    消息与共享文档
D:\Others        资料、教材
D:\LLM           代码与配置
```

**⇒ 整盘加会让索引涨到几十万项，检索反而变慢。**

### 4.5 SSH 场景：进程必须投到会话 1

**⇒ 直接 SSH 启动会落在 session 0，看不到窗口、进程还会被杀。**

```bat
schtasks /create /tn WinShunStart /tr "\"D:\LLM\WinShun\WinShun\WinShun.exe\"" /sc once /st 23:59 /it /f
schtasks /run /tn WinShunStart
```

**⇒ `/it` 是关键 —— 投到交互会话。**

---

## 五、agent 标准用法（可直接抄）

```bash
# ① 先确认就绪
ws status

# ② 按名字找（支持拼音、首字母、扩展名）
ws find "*.mkv"
ws find "msxz"                      # 首字母
ws find "zhuomian"                  # 全拼
ws find "*.json" --in D:\ACP-Shared -n 20

# ③ 按内容找（Everything 做不到）
ws grep "关键词" --in D:\ACP-Shared
ws grep "关键词" --timeout 30s       # 大范围放宽时限

# ④ 读文档正文（docx / xlsx / pptx / pdf 都行）
ws text "D:\某文件.docx"

# ⑤ 列目录（走索引，大目录也快）
ws ls D:\ACP-Shared\outbox\<某agent> -n 0

# ⑥ 最近改过的
ws recent -n 20

# ⑦ 机器可读
ws find "报告" --json -l
```

**⇒ 退出码：`0` 成功｜`1` 无结果｜`3` 未运行｜`4` 命令行未开放｜`6` 路径不在索引｜`7` 失败。**

---

## 六、怎么选

| 你的需求 | 选 |
|---|---|
| 人敲界面，全盘秒找文件 | **Everything** |
| agent 搜文件正文、拼音检索、读文档 | **WinShun** |
| agent 要一个零配置的 HTTP 接口 | **Everything**（HTTP 8089） |
| agent 要一个能读 docx/pdf 正文的接口 | **WinShun**（`ws text`） |
| 内存紧张（<4 GB） | **Everything**（工作集更小） |

**⇒ 两者可以共存，互不干扰，内存叠加约 270 MB。**

**⇒ 唯一注意：别把全局快捷键设成一样的。**

---

## 附：实测环境

```
CPU/内存    i7-8700 / 32 GB
系统        Windows 11
WinShun     0.33.0 便携版｜D:\LLM\WinShun\WinShun\
            索引 295,220 项（C 用户目录 + D:\ACP-Shared + D:\Others + D:\LLM）
            快捷键 Ctrl+L
Everything  HTTP 127.0.0.1:8089｜全盘 133 万+ 文件
            快捷键 Ctrl+Shift+F
```
