# Codex 桌面端「模型加载中」卡死

> 现象：升级到 `26.1013` 后，Codex 桌面端打开任何会话（新的、旧的）都停在"正在加载模型"，
> 有时弹出 `Work browser access requires an authenticated account`；但同一台机器上 `codex` CLI 完全正常。

这是一篇**病历式记录**：不是 DeepSeek 配置写错了，而是桌面端的「模式 + 登录态 + 模型记忆」三者叠加形成的死锁。
完整排查过程、代码级定位、修复步骤和备份清单见 [report-2026-10-18.md](report-2026-10-18.md)。

---

## 一句话根因

桌面端升级后，**free 账号**被判定为 `codexLocalAccess = false`，UI 因此强制停在 **ChatGPT Work 模式**；
Work 模式要求 ChatGPT 账号身份，而登录态已过期、`forced_login_method = "api"` 又把登录入口堵死；
同时 provider 指向 DeepSeek，Work 模式却要按 OpenAI 模型初始化会话 —— 于是会话初始化卡住，界面永远"正在加载模型"。

```
升级 26.1013
  → free 账号 codexLocalAccess=false
  → 强制 Work 模式
  → Work 要求 ChatGPT 身份
  → auth.json 过期 + forced_login_method="api" 堵死登录
  → Work 模式下用 OpenAI 模型初始化会话，provider 却是 DeepSeek
  → 卡在「正在加载模型」/ 报 Work browser access requires an authenticated account
```

## 关键特征

- **只在「用 Work 模式冷启动会话」时报错**；先在 Codex 打开会话、再切 Work 不会报错（会话已用 DeepSeek 初始化完成）
- CLI 一切正常 → 说明 `config.toml` / `models.json` / API key 都没问题
- 旧会话还可能绑定已被移除的模型 slug（`deepseek-v4-flash`），会额外触发 fallback

## 修复要点

1. 注释 `forced_login_method = "api"`，否则 `codex login` 直接报 `ChatGPT login is disabled`
2. `codex login` 重新登录（需要浏览器 + MFA）
3. 退出应用后，把 `.codex-global-state.json` 的 `home-composer-mode-v1` 改为 `codex`、`chatgpt-last-selected-model-v1` 改为 `deepseek-flash`
4. `conversationDetailMode` 改为 `STEPS_COMMANDS`（`STEPS_PROSE` 是 Work 模式专用值）
5. 旧会话的 `model` 从 `deepseek-v4-flash*` 改为 `deepseek-flash`

> 改全局状态和数据库前**必须先完全退出桌面端**，否则会被运行时状态覆盖。

## 社区反馈

| 来源 | 内容 | 状态（2026-10-18） |
|---|---|---|
| [#54841](https://github.com/openai/codex/issues/54841) | Windows / `26.1013.40934` / BYOK，报错逐字一致，同样定位到 `requireWorkBrowserIdentity` + `STEPS_PROSE` + `node_repl` | open，0 评论，未修 |
| [#29156](https://github.com/openai/codex/issues/29156) | 桌面端自定义 provider 与历史会话 / 模型选择器不可用 | open，13 评论 |
| [#37245](https://github.com/openai/codex/issues/37245) | 登录 ChatGPT 账号后，自定义 provider 被静默忽略，请求走账号 websocket | open |
| [#46282](https://github.com/openai/codex/issues/46282) | Windows 卡在 ChatGPT Work，点 Codex 无效 | open |

中文社区也有讨论：腾讯云《Codex Desktop 无法识别自定义模型的 5 种解决方法》、[zza-830/codex-deepseek-guide](https://github.com/zza-830/codex-deepseek-guide)（本地协议代理）、[V2EX 帖子](https://global.v2ex.co/t/1235510)（`codex-deepseek-router`，不改 `config.toml` 的子 Agent 路由方案）。

## 结论

这是客户端 bug，不是配置错误。在官方修复前，最稳的用法是：

> **保持 Codex 模式，不在 Work 模式下冷启动会话。**

如果你也遇到，先跑这两条确认是不是同一类问题：

```powershell
codex login status
codex exec -C <空目录> --skip-git-repo-check --sandbox read-only "只回复 OK"
```

CLI 正常 + 桌面端卡加载，基本就是同一类。

---

## 版本族谱（2026-10-18 由 Codex CLI 实测核对）

桌面版和 CLI **同源**（都用 Codex core），但**不是同一个软件包**，版本序列完全独立：

| 层 | 版本 | 怎么查 |
|---|---|---|
| CLI（npm 安装） | `0.147.0` | `codex --version` |
| 桌面版外层 MSIX 包 | `26.1013.4894.0` | `Get-AppxPackage -Name "*Codex*"` |
| 桌面版内层 Electron 应用 | `26.1013.40934` | `app.asar` 内 `package.json` |
| **桌面版内置的 codex 后端** | **`0.163.0-alpha.10.2`** | `<MSIX>\app\resources\codex.exe --version` |

**两个要点：**

1. **桌面版捆绑的后端比 npm CLI 还新**（`0.163.0-alpha.10.2` > `0.147.0`）。所以「升级 CLI 修桌面版」是走不通的 —— 它们各自升级。
2. **`26.1013.40934` 不是 MSIX 包版本**，那是内层 Electron 应用的版本；外层包是 `26.1013.4894.0`。查 issue #54841 时注意别对错号。

---

## 交叉核对的两点修正（Codex CLI 复核）

CDX 在本机 `app.asar` 里**直接搜到了同一处报错条件**，证实了报告的代码级定位：

```js
requireWorkBrowserIdentity && node_repl != null && principal == null
  → throw Error('Work browser access requires an authenticated account')
```

同时提出两点修正，原报告已按此更新：

| 项 | 原报告 | 修正后 |
|---|---|---|
| `26.1013.40934` 的层级 | 标为 MSIX 包版本 | **内层 Electron 应用版本**（外层 MSIX 是 `26.1013.4894.0`） |
| originator 修改的必要性 | 列为修复步骤之一 | **不能证明是必要根因** —— 这一次同时改了登录态、模式、模型记忆、45 个会话 model、22 个 originator，多变量并发，只能视为「兼容性清理」 |

**方法论提醒**：一次修复合了多个改动时，别把每个改动都当成必要条件写进结论 —— 下次照抄可能白改。

---

## 附带发现的另一个坑：Windows 沙箱 runner 挂了

排查过程中撞上第二个独立故障，**与模型加载问题无关**：

```
codex exec -s workspace-write ... 
→ windows sandbox: timed out after 15000ms connecting runner pipe-in
```

- 连裸 `echo` 都失败；`-s danger-full-access`（不走沙箱）完全正常
- 桌面版退出、node 进程清零后仍然复现 ⇒ **不是配置文件冲突**
- DSH 不受影响，因为 DSH 用自己的沙箱实现（`dsh-sandbox-windows-acl`），不走 `codex-windows-sandbox-service`

**临时绕法**：唤醒脚本 `wake-codex.cmd` 默认改用 `danger-full-access`（备份 `.bak-20261018`）。
⚠️ **注意**：`danger-full-access` 没有沙箱保护，删除/移动/覆盖类任务必须先经人确认。

---

*版本族谱与交叉核对部分由蓝莓（Hermes）在 2026-10-18 依据 Codex CLI 的回复整理。*
