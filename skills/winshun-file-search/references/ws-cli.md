# WinShun 命令参考（ws CLI 全参数）

> 来源：`ws --help`（0.33.0 实测）＋ `docs/design-cli.md`
> 官方链接：https://github.com/LingCore/WinShun/blob/main/docs/design-cli.md

---

## 命令一览

| 命令 | 作用 | 例子 |
|---|---|---|
| `find` | 按名字找文件和文件夹（**默认命令**） | `ws find "报告"` / `ws "报告"` |
| `grep` | 按内容找：文件里的文字，Word/Excel/PPT/PDF 也行 | `ws grep "发票 2024"` |
| `recent` | 最近改过的文件，最新在前 | `ws recent --days 7` |
| `text` | 读出文件里的文字（docx/xlsx/pptx/pdf） | `ws text "D:\a.docx"` |
| `ls` | 列出文件夹里的东西（走索引，大目录也快） | `ws ls "D:\Projects"` |
| `open` | 打开最匹配的那个（同启动器里按 Enter） | `ws open "plan" --ext docx` |
| `clip` | 剪贴板历史（需用户授权） | `ws clip -n 5` |
| `plugin` | 插件：列出/搜索/安装/开关/卸载 | `ws plugin list` |
| `status` | 在不在运行、索引好了没 | `ws status` |
| `skill` | 给 AI 用的说明（装指令到客户端） | `ws skill --install claude` |
| `help` | `ws help <命令>` | `ws help grep` |

---

## 全局选项

| 选项 | 作用 |
|---|---|
| `-n, --limit <数量>` | 最多几个（默认 100；`0` = 能给多少给多少） |
| `-l, --long` | 加上大小和修改时间 |
| `--json` | 输出一个 JSON 数组（一行）—— 给程序读 |
| `-0, --null` | 路径用 NUL 分隔（给 `xargs -0`） |
| `--in <文件夹>` | 只在这个文件夹里找（可写多次；`.` = 当前目录） |
| `--ext <扩展名>` | 只要这些扩展名，逗号分开：`--ext pdf,docx` |
| `--files` / `--folders` | 只要文件 / 只要文件夹 |
| `--sort <顺序>` | `match`（默认，最相关在前）、`newest`、`oldest`、`name`、`folder`、`type`、`largest`、`smallest` |
| `--wait <时间>` | 索引没准备好时最多等多久（默认 10s；`0` = 不等） |
| `--no-start` | WinShun 没在运行时不启动它 |
| `--color <何时>` | `auto`（默认）、`always`、`never` |
| `--encoding <编码>` | 非控制台时的编码：`utf8`、`utf16`、`ansi`、`oem`、`console` |
| `--timeout <时长>` | `grep` 专用：放宽搜索时限（默认 5s，最多 30s） |

---

## 查询语法（find）

```
所有词都要匹配 —— 在文件名里，或在父文件夹名里
中文名也匹配拼音    bg / baogao → 报告
"精确短语"          加引号
!word               排除
*.pdf  ?            通配符
ext:pdf,docx        按扩展名
folder\name         按路径
```

**⇒ 技巧：想不起怎么说，就换同义词、短词干、中英文都试（报销 / 费用 / reimbursement），再不行上 `ws grep`。**

---

## grep 命中格式

```
path:line:text                普通文本文件
path:p3:text                  PDF 第 3 页
path:s2:text                  PPT 第 2 张
path:[Sheet1]r12:text         Excel Sheet1 第 12 行
```

**⇒ 支持 `"a|b"` 任一匹配。**

**⇒ 支持 `regex:xxx` 正则（行内匹配）；带固定文本时更快。**

---

## 退出码

| 码 | 含义 | 怎么办 |
|---|---|---|
| `0` | 有结果 | — |
| `1` | 没有结果 | 换词、放宽范围 |
| `2` | 用法不对 | 看 `ws help` |
| `3` | WinShun 没在运行 | 启动它，或去掉 `--no-start` |
| `4` | 设置里没开放 | **让用户去开那个开关**（stderr 会说是哪个） |
| `5` | 索引还没好 | `--wait 30s` |
| `6` | 路径看不到 | 该目录不在索引范围 |
| `7` | 其他错误 | 看 stderr；grep 并发被占就重跑一次 |
| `130` | Ctrl+C | — |

---

## 输出约定

```
stdout   一行一个完整路径
stderr   提示信息，都以 ws: 开头
```

**⇒ PowerShell 中文乱码：在 profile 里加**

```powershell
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
```

---

## 引号与顺序铁律

```
① 查询一定要加引号 —— bash 会先把 * 换成文件名
② 选项写在 -- 前面；-- 之后全是查询词
   正确：ws -n 5 -- recent
   错误：ws recent -n 5 --（-n 会被当成查询词）
③ 第一个词正好是命令名时，用 ws find <词> 或 ws -- <词> 消歧
```
