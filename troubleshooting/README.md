# Troubleshooting · 故障排查

> 踩过的坑、定位过程和最终解法。

这里不是教程，是**病历**：现象 → 根因 → 证据 → 修法 → 验证。
每篇都尽量写成"下次再遇到，照着走一遍就能出来"的形式，并且把社区里对应的 issue / 讨论一起记下来，方便判断是"我配错了"还是"软件有 bug"。

---

| 问题 | 对象 | 关键词 | 目录 |
|---|---|---|---|
| **Codex 桌面端「模型加载中」卡死** | ChatGPT / Codex Desktop `26.1013` + 自定义 provider（DeepSeek） | Work 模式、BYOK、`forced_login_method`、`auth.json` | [`codex-desktop-model-loading/`](codex-desktop-model-loading/) |

---

> 记录原则：**先分诊，再深挖**。能用 CLI 复现/排除的，就不要一上来翻客户端代码。
