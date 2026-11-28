---
name: zlib-ebook-cli
description: Use when agent 要找电子书、下书、或查书中资料。zlib 命令行工具，零依赖，搜书不扣额度。
---

# zlib：命令行找书、下书

> 一个 Go 写的单文件工具，把 Z-Library 的搜索/下载变成命令。
> **核心价值：agent 不用浏览器、不用登录态托管，一条命令就能查书。**

## 零、什么时候用这个技能

```
✅ 想查某本书有没有、什么版本、什么格式
✅ 想按作者/年份/语言批量查
✅ 要下载电子书
✅ 要发 Kindle 或导微信读书
✅ 要下载历史、收藏、热门榜
```

**⇒ 不适合：**需要看书评、需要完整内容简介（工具没有这个字段）。

---

## 一、是什么

| 项 | 值 |
|---|---|
| 仓库 | `github.com/heartleo/zlib` |
| 语言/协议 | Go / MIT |
| 形态 | 单文件 CLI（19 MB），也有 TUI 和 MCP |
| 硬件要求 | 极低，跑一次几十 MB，执行完就退 |
| 唯一开销 | 网络（下载文件时） |

**⇒ 不常驻、不开端口、不装驱动、不依赖浏览器。**

---

## 二、安装

### Linux / macOS

```bash
# 官方脚本（需能访问 GitHub，受限时加 -x 代理）
curl -fsSL https://raw.githubusercontent.com/heartleo/zlib/main/install.sh | sh

# 手动（推荐，避开 GitHub API 限流）
curl -L -o zlib.tar.gz \
  https://github.com/heartleo/zlib/releases/download/v0.0.16/zlib_0.0.16_linux_x86_64.tar.gz
tar -xzf zlib.tar.gz
mkdir -p ~/.local/bin && cp zlib ~/.local/bin/ && chmod +x ~/.local/bin/zlib
zlib version
```

### Windows

```powershell
winget install --id heartleo.zlib --exact
# 装完必须重开终端，或用完整路径：
%LOCALAPPDATA%\Microsoft\WinGet\Links\zlib.exe version
```

---

## 三、首次使用（三步）

```bash
# 1. 找能通的域名
zlib doctor
zlib doctor --proxy http://127.0.0.1:7897    # 直连不通时

# 2. 从结果挑一个登录
zlib login --domain https://<可用域名>
# 交互输入邮箱和密码；登录后域名写进 ~/.config/zlib/.env

# 3. 验证
zlib profile     # 看账号、计划、今日额度
```

**⇒ 走代理的环境要设：**`export ZLIB_PROXY=http://127.0.0.1:7897`

---

## 四、常用命令

### 搜索（不扣额度）

```bash
zlib search "关键词"
zlib search "关键词" --language chinese --ext epub
zlib search "关键词" --from-year 2010 --to-year 2020
zlib search "关键词" --json --count 20      # 给程序用
```

**⇒ 排序：**`--order popular|bestmatch|date|title|year|filesize`

**⇒ 返回字段：**id、hash、name、authors、publisher、year、language、extension、size、isbn、rating、quality、cover、description（可能为空）。

### 下载（每天 10 本）

```bash
zlib download <id:hash> --dir <目录>
zlib download <id:hash> --dir <目录> --json    # 输出真实路径和大小
zlib download <id:hash> --send-to-kindle
zlib download <id:hash> --send-to-weread
```

**⇒ id 格式 `数字:hash`，**hash 是 6 位十六进制。

### 其他

```bash
zlib favorites / history / most-popular / recommended
zlib meta <文件>       # 查/改电子书元数据
zlib tui               # 终端界面
zlib mcp               # MCP 服务（stdio）
zlib config network domain   # 换域名
```

---

## 五、额度

| 操作 | 扣额度 |
|---|---|
| 搜索 / 查详情 / 收藏 / 历史 / 热门 / 元数据 | ❌ 不限 |
| **下载** | ✅ 每天 10 本（注册账号） |
| 未注册 | 每天 5 本 |

**⇒ `zlib profile` 随时查。**

---

## 六、七个坑（都踩过）

**⇒ ① 域名和账号可能不通用**
某个域名浏览器能登，工具报 `Incorrect email or password`，说明该域名的账号体系是分开的。
→ 在 `doctor` 列出、且工具内置支持的域名上注册账号。

**⇒ ② 自建镜像验证必失败**
`zlib mirrors add` 会去访问域名做验证，被 Cloudflare 拦就 403，`--yes` 也绕不过。
→ 只用官方域名。

**⇒ ③ 从浏览器导 cookie 走不通**
Chrome 127+ 的登录 cookie 用 App-Bound Encryption，密钥绑浏览器进程：
关浏览器→密钥失效→解出乱码；不关→数据库被锁→读不了。
→ 别走这条路，直接用账号密码登录。

**⇒ ④ Cloudflare 整页挑战，无头浏览器过不去**
只有一句「正在进行安全验证」，无勾选框、无图片验证，检测浏览器指纹。
→ 需要人操作的场景让人做；能走 CLI 的别碰浏览器。

**⇒ ⑤ GitHub API 限流导致安装失败**
安装脚本调 `releases/latest`，被限流返回 403。
→ 直接写死版本号下 Releases 包。

**⇒ ⑥ Windows 装完命令找不到**
PATH 要重开会话才生效。
→ 用完整路径。

**⇒ ⑦ 简介字段不可靠**
`description` 要么空，要么是扫描目录。
→ 需要真正简介就自己读正文写，或查外部源。

---

## 七、给 agent 的四种用法

```bash
# ① 只查不下（完全免费）
zlib search "书名 作者" --json --count 5

# ② 查→下
zlib search "书名" --json | # 取 id
zlib download <id> --dir ./books --json

# ③ 批量查（不下载，不扣额度）
for q in "书1" "书2"; do zlib search "$q" --json --count 3; done

# ④ MCP 接入
zlib mcp
```

**⇒ 给 agent 挂 MCP 时，**建议只暴露 `search`，**`download` 由人点头。**

---

## 八、和其他工具的分工

| 场景 | 用什么 |
|---|---|
| 查书有没有、什么版本 | zlib search（免费） |
| 下书 | zlib download（每天 10 本） |
| 看封面、目录 | search 的 JSON 里有 cover/description |
| 真正的书评简介 | 外部源（豆瓣、出版社页） |
| 需要登录态的网页 | 人做，或 Playwright 有头 |

**⇒ 一句话：**能在 CLI 干的别开浏览器，**能走 API 的别开无头浏览器。**

---

## 九、速查

```
doctor   → 找可用域名
login    → 登录（--domain 必给）
profile  → 查额度和账号
search   → 搜（不扣额度，--json 给程序）
download → 下（扣额度，id:hash 格式）
mcp      → 给 agent 当工具
```

**⇒ 三条铁律：**

```
① 域名只用 doctor 列出的那批
② 账号密码登录，别折腾 cookie
③ 搜索免费、下载收费，看清楚再用
```
