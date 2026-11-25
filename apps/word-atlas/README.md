# 词光 Word Atlas · Windows 本地部署

> 一个开源的雅思背单词 PWA：7,298 词、7,298 幅插画、22,905 段英美发音、FSRS 间隔复习。
> 本文只讲**怎么在 Windows 上跑起来**，以及**局域网里手机怎么扫一下就用**。
> 应用本身不是我们写的，我们写的是「一键启动 + 扫码入口」这一层。

---

## 零、这是一个什么项目

| 项 | 值 |
|---|---|
| 仓库 | `designfuchen/word-atlas` |
| 在线版 | https://0xlei.tech/words/ |
| 技术栈 | React 19 · TypeScript · Vite 6 · ts-fsrs · WebGL2 |
| 代码许可 | MIT |
| 内容许可 | CC BY 4.0（词库文本、插画、词条录音） |
| 体量 | 仓库约 650 MB（图 + 音全在里面）；克隆后 37,728 个文件 |
| 数据 | 词条 7,298 / 例句 14,596 / 插画 7,298 / 录音 22,905 |

**⇒ 它没有后端。** 进度存在浏览器的 `localStorage` 里，没有账号、没有服务器。
**⇒ 这一点决定了后面所有关于「换 IP」「多设备」的行为。**

---

## 一、Windows 部署（实跑记录）

### 1.1 环境

```
Node.js   v24.13.0      （官方要求 20+）
npm       11.6.2
git       2.55.0
```

### 1.2 拉代码

**⇒ 仓库大，加 `--depth 1` 只拉最新一版，能省一半时间。**

```cmd
git clone --depth 1 https://github.com/designfuchen/word-atlas.git C:\LLM\word-atlas
```

**⇒ 国内直连慢的话，先给 git 挂代理：**

```cmd
set http_proxy=http://127.0.0.1:7897
set https_proxy=http://127.0.0.1:7897
git clone --depth 1 https://github.com/designfuchen/word-atlas.git C:\LLM\word-atlas
```

**⇒ 实测：**37,728 个文件，代理下约 50 秒。**

### 1.3 装依赖

```cmd
cd /d C:\LLM\word-atlas
npm ci --no-audit --no-fund
```

**⇒ 实测：**80 个包，7 秒。（`npm ci` 比 `npm install` 快且锁版本）

### 1.4 构建

```cmd
npm run build
```

**⇒ 实测：**`vite build`，1620 个模块，**19.68 秒**，产物在 `dist/`（9 个文件，主 JS 383 KB）。

### 1.5 起服务

**⇒ 不用 `npm run dev`（那是开发模式，慢且不压缩）。**
**⇒ 用 `vite preview` 跑构建产物：**

```cmd
npx vite preview --port 4173 --host
```

**⇒ 看到这个就成功了：**

```
➜  Local:   http://localhost:4173/
➜  Network: http://<本机局域网IP>:4173/
```

**⇒ `--host` 必须加，否则只有本机能访问，手机连不上。**

### 1.6 防火墙（第一次要加，之后不用）

**⇒ Windows 默认拦外部入站，手机连不上就是这个原因。**

```cmd
netsh advfirewall firewall add rule name="WordAtlas 4173" dir=in action=allow protocol=TCP localport=4173
```

**⇒ 验证：**

```cmd
powershell -c "Get-NetTCPConnection -LocalPort 4173 | Select State"
→ Listen
```

**⇒ 从另一台机器访问验证：**

```bash
curl -s http://<台式机IP>:4173/ | grep -o '<title>[^<]*</title>'
→ <title>词光 Word Atlas · 一词一画，点亮雅思</title>
```

---

## 二、一键启动 + 扫码（我们加的那一层）

### 2.1 为什么要加

**⇒ 台式机不是长期开机，每次重启 **DHCP 会给新 IP**：**

```
见过 …​.110 / .112 / .114 / .117（尾号每次都不同）
```

**⇒ 手工查 IP、念给手机输入，太麻烦，而且容易念错。**

**⇒ 所以做成：**双击一次 → 自动探测当前 IP → 打印地址 + 终端二维码 → 手机扫。**

### 2.2 文件

```
C:\LLM\word-atlas\tools\serve-wordatlas.mjs     ← 启动器（本项目提供）
C:\LLM\word-atlas\启动词光.bat                   ← 双击入口
```

**⇒ `serve-wordatlas.mjs` 干四件事：**

```
① 已有服务在跑 → 直接报地址，不重复起
② 没有 dist   → 先 npm run build
③ 探测局域网 IP（跳过虚拟网卡，192.168.* 优先）
④ 打印地址 + 终端二维码，然后起 vite preview
```

**⇒ 核心点：**每次启动都重新探测，**绝不缓存、绝不写死 IP。**

**⇒ IP 探测的排序逻辑（家用网段优先）：**

```js
192.168.*  → 0   // 最可能
10.*       → 1
172.16-31.*→ 2
其它        → 3
```

**⇒ 跳过这些网卡：**`vmware | virtualbox | vether | hyper-v | wsl | bluetooth | tap | tun`

### 2.3 `启动词光.bat`

```bat
@echo off
chcp 65001 >nul 2>&1
title Word Atlas - 词光（这个窗口不要关）
cd /d C:\LLM\word-atlas
if not exist node_modules ( echo 首次运行，安装依赖... & call npm ci --no-audit --no-fund )
node tools\serve-wordatlas.mjs
pause
```

**⇒ 注意编码：**`chcp 65001` 让 CMD 走 UTF-8，否则中文标题是乱码。

### 2.4 桌面图标

**⇒ 建个快捷方式指向 `启动词光.bat`，工作目录 `C:\LLM\word-atlas`。**

**⇒ 双击 → 黑窗口弹出 → 里面有地址和二维码 → 手机扫。**

**⇒ 这个窗口不能关，关了服务就停。**

### 2.5 实测结果

```
启动 → 端口 4173 Listen
本机 http://127.0.0.1:4173        200
跨机 http://<本机局域网IP>:4173    200，标题正确
词库 /atlas/index.json            count 7298，illustrated 7298，voiced 7298
```

---

## 三、手机怎么用

### 3.1 第一次

```
① 双击桌面「词光」
② 手机会出现地址 http://192.168.x.x:4173 和一个二维码
③ 手机相机扫 → 浏览器打开
④ 分享 → 添加到主屏幕 → 变成一个 App
⑤ 开始背单词
```

### 3.2 IP 变了怎么办

**⇒ 台式机重启后 IP 会变，手机旧图标就打不开了。**

```
① 台式机双击「词光」，看新地址 / 扫新码
② 手机上长按旧图标 → 删除
③ 用新地址重新「添加到主屏幕」
```

### 3.3 学习进度会丢吗

**⇒ 这才是要讲清楚的地方。**

```
同一网址打开     → 进度自动在   （localStorage 里）
网址变了         → 进度读不到，页面是空的
```

**⇒ 关键：`localStorage` 绑定的是「协议 + 域名 + 端口」（同源）。**
**⇒ IP 变了 = 换了源 = 读不到旧数据。**

**⇒ 所以：**IP 变之后，要用备份文件把进度搬过去。**

---

## 四、导出 / 导入备份（手动，已实测）

### 4.1 在哪

**⇒ 应用底部导航的 **「我」** 页，两个按钮：**

```
导出备份   → 下载 word-atlas-backup-<日期>.json
导入备份   → 选一个 json 文件，恢复
```

### 4.2 备份文件长什么样

**⇒ 是一份普通 JSON（源码 `src/store/store.ts` 的 `exportBackup()`）：**

```json
{
  "app": "word-atlas",
  "version": 2,
  "exported": "2026-11-25T...",
  "progress": { "datasetId": "...", "cards": { ... } },
  "settings": { ... }
}
```

**⇒ 导入时会校验：**

```
app 必须是 word-atlas
version 必须是 2
progress.datasetId 必须和当前词库一致
```

**⇒ 校验不过就报错，不会污染现有进度。**

### 4.3 备份存在哪台设备

**⇒ **在哪台设备点导出，就存到哪台设备**。**

```
手机点导出 → 下载到手机
电脑点导出 → 下载到电脑
```

**⇒ 跨设备恢复：**把 json 传过去（微信 / 网盘），在目标设备上点「导入备份」选它。

**⇒ 注意：**导入会**覆盖**当前进度。所以顺序永远是「先导出，再导入」。

### 4.4 多设备是分开的

**⇒ 每台设备的浏览器各存各的，天然隔离。**

```
爸爸的手机  、妈妈的手机  、台式机的浏览器
→ 三份独立进度，互不影响
```

**⇒ 同一个手机换浏览器（Safari → Chrome）也是分开的。**

---

## 五、能不能「IP 变了自动恢复」？

**⇒ 现在**不能**，只能手动点一次导入。**

**⇒ 因为整个应用没有后端，浏览器不可能自己去读别的设备的数据。**

### 三条可选路线

| 方案 | 做法 | 代价 | 评价 |
|---|---|---|---|
| **① 固定网址（治本）** | 路由器给台式机绑固定 IP，或在局域网做 mDNS（`wordatlas.local:4173`） | 零代码 | **推荐**。网址不变，进度永远在 |
| **② 服务端存备份** | 启动器加 `/api/backup`，前端改成自动拉取 + 自动上传 | 约 150 行、涉及 3 个文件 | 有效，但改了核心存储逻辑，测不全容易出问题；且「进度只在手机」这个卖点就没了 |
| **③ 手动导入** | 不改代码，教用户点两下 | 零成本 | 10 秒的事，够用 |

**⇒ 我们的选择：**目前用 ③；如果能绑固定 IP，就升级成 ①。**

---

## 六、踩过的坑

| 现象 | 原因 | 解 |
|---|---|---|
| 本机能开、手机连不上 | Windows 防火墙拦入站 | `netsh advfirewall` 加 4173 规则 |
| 从别的机器 `curl` 超时 | 同上（不是服务没起） | 先看 `Get-NetTCPConnection -LocalPort 4173` 是否 Listen |
| `--host` 没加，局域网访问不到 | vite 默认只听 localhost | 必须 `--host` |
| `.bat` 里中文乱码 | CMD 默认 GBK | 开头加 `chcp 65001` |
| 用 Python 写 `.bat` 报 `UnicodeEncodeError` | 用 `encoding="ascii"` 写中文 | 用 `encoding="utf-8"` 或 `gbk` |
| `schtasks /it` 起的服务，SSH 里测通但跨机不通 | 防火墙 | 同第一条 |
| 仓库 clone 很慢 / 断 | 650 MB，国内直连不稳 | 挂代理 + `--depth 1` |
| 换 IP 后进度空白 | `localStorage` 同源隔离 | 导出/导入备份，或固定 IP |

---

## 七、目录结构（部署后）

```
C:\LLM\word-atlas\
├── dist\                    构建产物（服务实际跑这个）
├── node_modules\            80 个依赖
├── public\atlas\img\        7,298 幅插画
├── public\atlas\audio\      22,905 段录音
├── src\                     源码（React + TS）
├── tools\serve-wordatlas.mjs    我们加的启动器
├── 启动词光.bat                  双击入口
├── package.json
└── vite.config.ts
```

---

## 八、一句话总结

> **它是纯前端应用，没有后端；部署就是 clone + `npm ci` + `npm run build` + `vite preview --host`。**
> **剩下的麻烦全是两件事：防火墙放行、IP 会变。**
> **IP 会变这件事，能绑固定地址就绑；绑不了，就教会用「导出/导入备份」——十秒的事。**

---

*本文记录 2026-11-25 在 Windows 台式机上的完整实跑。应用由 designfuchen 开发（MIT / CC BY 4.0），本文只覆盖部署与使用。*
