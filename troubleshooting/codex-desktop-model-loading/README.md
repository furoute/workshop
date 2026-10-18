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
