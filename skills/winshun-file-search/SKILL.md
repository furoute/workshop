---
name: winshun-file-search
description: Use when 要在 Windows 上搜文件正文（docx/pdf 里的字）、用拼音首字母找中文文件名，或把一个能读文档的检索接口交给 agent。WinShun 的 ws 命令 + MCP，含与 Everything 的横评和人工介入点。
version: 1.0.0
author: 蓝莓(Hermes)
license: MIT
metadata:
  hermes:
    tags: [winshun, windows, file-search, full-text-search, pinyin, mcp, agent]
    related_skills: [everything-http-search, self-hosted-kb]
---

# WinShun 文件检索（搜正文 / 拼音 / 读文档）

> **🤖 给智能体**：这是照着做就行的操作手册。先看「三条判断」，再按「标准用法」抄命令。
> **最要紧的一句：搜正文和拼音是 Everything 做不到的，所以这个技能不是替代，是补位。**

## When to Use

- 要搜**文件里的字**（「哪个文档提到过这个词」），不是只搜文件名
- 中文文件名记不全，想用**拼音或首字母**找（`msxz` → 某部电影）
- 要 agent 直接**读出 docx / xlsx / pptx / pdf 的正文**，不想另装解析库
- 已经装了 Everything，但发现它搜不到内容

**不适用**：只搜文件名（用 `everything-http-search` 更快更全）；跨文件语义推理（那是向量库）。

---

## 📚 参考资料（`references/`）

| 文件 | 内容 | 什么时候看 |
|---|---|---|
| [ws-cli.md](references/ws-cli.md) | **命令全参数**：11 个命令 / 全局选项 / 查询语法 / grep 命中格式 / 退出码 / 引号铁律 | 写命令、选项不确定 |
| [features.md](references/features.md) | **能力全表**：15 章官方功能（文件搜索 / 全文 / 应用 / 网页 / 插件 / 剪贴板 / 截图 / MCP…） | 判断它还能干什么 |
| [mcp-integration.md](references/mcp-integration.md) | **MCP 接入**：安全四原则 / 一键配置 / 装指令到 Claude、Cursor / MCP vs `ws` 怎么选 | 接别的 AI 客户端 |
| [official-skill.md](references/official-skill.md) | **官方给 AI 的说明书原文**（英文，4 KB） | 与我们的说法冲突时以它为准 |

> **给任何 agent**：本文是速查；细节去上面四个文件查，别凭印象写。
> 官方随时改版 —— 拉最新：
> `gh api repos/LingCore/WinShun/contents/skills/winshun/SKILL.md --jq .content | base64 -d`

---

## 三条判断（先想清楚再动手）

```
① 只找文件名     → Everything（全盘 133 万，0.02 秒）
② 要找正文/拼音  → WinShun（ws grep / ws find）
③ 要读文档内容   → WinShun（ws text，docx/pdf 直出纯文本）
```

**两者可以共存，不冲突，内存叠加约 270 MB。** 别把全局快捷键设成同一个。

---

## ⚠️ 人工介入点（这三步 agent 干不了）

| 步骤 | 为什么人必须在 |
|---|---|
| **① 首次安装** | 未签名，Windows 弹「已保护你的电脑」→ 要人点「更多信息 → 仍要运行」 |
| **② 首次启动向导** | 卡在 `onboardingWindow`，日志报「Could not bring the window to the front」。**SSH 会话（session 0）里根本弹不出窗口**，必须人坐在机器前点一遍 |
| **③ 第一次配搜索范围** | 默认只索引 C 盘用户目录（桌面/文档/下载/图片/视频/音乐/OneDrive），D 盘要手动加 |

**这三步过完，后面全自动：**

- 新增文件 → USN 日志秒级跟上，无需任何干预
- 改配置 → agent 可改 `WinShun.ini` 后重启（**按纪律先问用户**）
- 所有检索 → agent 直接跑 `ws`

**⇒ 一句话：安装要人，之后交给 agent。**

---

## 安装部署

### 1. 下载便携版（推荐，不写注册表）

```bash
gh release download <最新tag> -R LingCore/WinShun -p 'WinShun-*-portable.zip'
```

便携版约 43 MB，解压即用，数据在旁边的 `data\`，**删文件夹即卸载**。

### 2. 首次启动（人操作）

```
解压 → 双击 WinShun.exe → 更多信息 → 仍要运行
→ 首启向导：选搜索范围 / 剪贴板开关 / 唤醒快捷键 → 开始使用
```

### 3. 打开命令行接口（agent 用的前提）

**界面**：设置 → AI 助手 → 权限 → 启用命令行

**或改配置**：`data\WinShun\WinShun.ini`

```ini
[Mcp]
Enabled=true
```

改完必须重启进程：

```bat
taskkill /IM WinShun.exe /F
schtasks /run /tn <你的启动任务名>
```

### 4. 加搜索范围

改 `[Index]` 段的 `Folders=`，逗号分隔：

```ini
Folders=C:\\Users\\<用户>\\Desktop, C:\\Users\\<用户>\\Documents, D:\\工作目录, D:\\资料
```

**建议只加具体目录，别整盘** —— 整盘会让索引涨到几十万项，检索反而变慢。

### 5. SSH 场景：进程必须投到会话 1

直接 SSH 启动会落在 session 0，**看不到窗口、进程还会被杀**：

```bat
schtasks /create /tn WinShunStart /tr "\"<exe 全路径>\"" /sc once /st 23:59 /it /f
schtasks /run /tn WinShunStart
```

**`/it` 是关键 —— 投到交互会话。**

### 6. 验证

```bash
ws status
# Win顺 0.33.0：在运行
# 索引：就绪，N 项
# 内容索引：开，M 个文件
```

---

## 标准用法（可直接抄）

```bash
# ① 先确认就绪
ws status

# ② 按名字找（支持拼音 / 首字母 / 扩展名）
ws find "*.mkv"
ws find "msxz"                       # 首字母
ws find "zhuomian"                   # 全拼
ws find "*.json" --in D:\某目录 -n 20

# ③ 按内容找 —— Everything 做不到的那件事
ws grep "关键词" --in D:\某目录
ws grep "关键词" --timeout 30s        # 大范围放宽时限

# ④ 读文档正文（docx / xlsx / pptx / pdf 都行）
ws text "D:\某文件.docx"

# ⑤ 列目录（走索引，大目录也快）
ws ls D:\某目录\子目录 -n 0

# ⑥ 最近改过的
ws recent -n 20

# ⑦ 机器可读
ws find "报告" --json -l
```

**退出码**：`0` 成功｜`1` 无结果｜`3` 未运行｜`4` 命令行未开放｜`6` 路径不在索引｜`7` 失败。

---

## 与 Everything 横评（实测）

> 同一台机器（i7-8700 / 32 GB / Win11），同一批查询。

| 维度 | Everything | WinShun |
|---|---|---|
| 索引规模 | 全部 NTFS 卷，**133 万+** | 手配目录，**29.5 万** |
| 索引实时性 | USN 日志，秒级 | USN 日志，秒级 |
| 文件名搜索 | 0.016–0.042 s | 0.016–0.032 s |
| **拼音 / 首字母** | ❌ | ✅ |
| **搜文件正文** | ❌ | ✅ `ws grep` |
| **读 docx/pdf 正文** | ❌ | ✅ `ws text` |
| 机器可读输出 | ✅ `json=1` | ✅ `--json` |
| 调用方式 | HTTP `:8089` | 命令行 `ws` + MCP |
| **工作集内存** | 210 MB（2 进程） | **59 MB**（1 进程） |
| 私有内存 | 162 MB | 237 MB |
| 线程数 | 25 | 178（Qt6） |
| 额外能力 | 无 | 剪贴板、OCR、插件、截图、MCP |

### 同一批查询对照

| 查询 | Everything | WinShun |
|---|---|---|
| 中文片名 | 8 条 / 0.042 s | 5 条 / **0.016 s** |
| 拼音首字母 | 搜不出 | ✅ 命中 |
| `*.mkv` | 支持 | 1 条 / 0.03 s |
| 文档正文里的词 | ❌ | ✅ 路径 + 行号 + 原文 |
| **纯日期串（如 20261113）** | **61 条** | **0 条 ⚠️** |

### ⚠️ 已知短板

**⇒ 纯数字串匹配弱。**

```
Everything  → 61 条
WinShun     → 0 条
```

**⇒ 大量文件用日期命名时会漏。**

**⇒ 规避：带扩展名 `--ext json`，或改用 `ws grep` 搜内容。**

---

## 怎么选

| 需求 | 用哪个 |
|---|---|
| 人敲界面找文件、全盘覆盖 | **Everything** |
| agent 搜正文、拼音检索、读文档 | **WinShun** |
| 零配置 HTTP 接口 | **Everything**（`:8089`） |
| 能读 docx/pdf 的检索接口 | **WinShun**（`ws text`） |
| 内存紧张（< 4 GB） | **Everything**（工作集更小） |

---

## 踩过的坑

| 现象 | 原因 | 修法 |
|---|---|---|
| `ws: Win顺 没有让命令行连接` | `[Mcp] Enabled=false` | 改配置 + 重启进程 |
| `Win顺 没在运行，也没能启动它` | SSH 起的进程在 session 0 被杀 | 用 `schtasks /it` 投到会话 1 |
| 首次启动卡住不弹窗 | `onboardingWindow` 在非交互会话弹不出来 | 人到机器前点一次 |
| `这个文件夹不在索引里` | 该目录未加入 `Folders=` | 加进去后重启 |
| `搜到时间上限就停了` | 内容索引没建完，临时扫盘超时 | `--timeout 30s`，或等索引建好 |
| 日期串搜不到 | 纯数字匹配弱 | 加 `--ext`，或改用 `grep` |

---

## 附：实测环境

```
Windows 11 / i7-8700 / 32 GB
WinShun 0.33.0 便携版
ws.exe 在 <安装目录>\bin\ws.exe
配置    <安装目录>\data\WinShun\WinShun.ini
快捷键  Ctrl+L（可自定义，别和 Everything 撞）
```
