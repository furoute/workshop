# Workshop

> A grab-bag of small tools, mini apps and agent skills.
> 小工具、小程序、Agent 技能的杂货铺。

这里放的是日常折腾出来的小东西 —— **不是大项目**（大项目单独开仓库，比如 [acp-lite](https://github.com/furoute/acp-lite)）。
每一样都配了一句说明，看完名字和说明就知道是什么。

---

## 📦 里面有什么

### Apps · 小程序

| 名称 | 是什么 | 技术栈 | 目录 |
|---|---|---|---|
| **单词猫 (WordPet)** | 小学英语背单词 PWA —— 人教 PEP 3-6 年级词库、云养猫、自然拼读、复习、打卡、家长报告 | Vite + TypeScript | [`apps/word-memory/`](apps/word-memory/) |

### Skills · Agent 技能

> 技能是给 AI agent 读的"操作手册"（`SKILL.md` + frontmatter）。**把整个文件夹交给你的 agent，它就能照着做。**

| 名称 | 用途 | 适用场景 | 目录 |
|---|---|---|---|
| **自建知识库** | 把一堆 Word/Excel/PPT/PDF 做成**可检索、可点开原件**的知识库 —— 七步流程（探针→去重→试读→分诊→裁决→建卡→呈现）、抽取→切块→向量四步流水线、FTS5 vs RAG 选型、检索降噪五项修法、**在线 API vs 本地小模型实测对比**、`file:///` 打开原件 | 手上一堆办公文档、想做成能查能用而不是只能看的库；或想在本机/离线环境跑一套 RAG | [`skills/self-hosted-kb/`](skills/self-hosted-kb/) |
| **Everything 文件检索** | 不点 UI、直接走 HTTP API 查 Windows 本地文件 —— 读 NTFS 主文件表，几十万文件毫秒级定位，零 Token；含全文搜索语法、正则陷阱、`schtasks` 投交互会话、跨会话调用 | Windows 上要秒级找文件、给 agent 加"找文件"能力；**Linux/macOS 不适用**（那边用 grep/find） | [`skills/everything-http-search/`](skills/everything-http-search/) |
| **多智能体协作** | 多个 AI agent 分工干一件事 —— 角色（调度/执行/复审/仲裁）、三种通道（广播/单线/CLI）、五步 workflow、留痕纪律 | 需要多个 agent 协作、或想让一个 AI 复审另一个 AI 的产出 | [`skills/multi-agent-collaboration/`](skills/multi-agent-collaboration/) |
| **GEO 生成式引擎优化** | 让你的项目/产品**被 AI 在回答里点到名**（含 GEO vs SEO 对比、四层基线测试、仓库内外物料、发文渠道矩阵、商业 B 端视角） | 任何"要被人/AI 找到"的项目 | [`skills/project-discoverability-geo/`](skills/project-discoverability-geo/) |
| **截图 → 项目简报** | 收到"刷到的项目"截图，自动定位 GitHub 项目、回源核验数据、输出中文简报 | 看到短视频/推文推的项目，想快速搞清楚 | [`skills/screenshot-to-project-brief/`](skills/screenshot-to-project-brief/) |
| **足球赛前比分预测** | 基于赔率的五步分析法 + 六步主观检查表 + 深盘爆冷筛查清单（通用版） | 任何足球赛事赛前预测 | [`skills/football-prediction-methodology/`](skills/football-prediction-methodology/) |
| **2026 世界杯预测** | 2026 FIFA World Cup 赛前比分预测流程（含球队追踪、伤病抓取） | 只适用于 2026 世界杯 | [`skills/world-cup-2026/`](skills/world-cup-2026/) |

### Troubleshooting · 故障排查

> 踩过的坑和最终解法，写成"病历"：现象 → 根因 → 证据 → 修法 → 验证。**不是教程，是下次再遇到能照着走一遍的记录。**

| 名称 | 是什么 | 关键词 | 目录 |
|---|---|---|---|
| **Codex 桌面端「模型加载中」卡死** | 升级到 `26.1013` 后 free 账号被强制 Work 模式、自定义 provider（DeepSeek）初始化失败；含代码级定位、修复步骤与官方 issue 对照 | Codex Desktop / BYOK / Work 模式 | [`troubleshooting/codex-desktop-model-loading/`](troubleshooting/codex-desktop-model-loading/) |

---

## 🚀 怎么用

### 用 App

```bash
cd apps/word-memory
pnpm install      # 或 npm install
pnpm dev          # 本地开发
pnpm build        # 构建（产物在 dist/，可直接部署）
```

> `dist/` 已随仓库提供，**不想装依赖的话，直接把它丢到任意静态服务器就能跑**。

### 用 Skill

技能是纯 Markdown。**把它复制到你所用 agent 的技能目录即可**：

| Agent | 技能目录 |
|---|---|
| **Claude Code** | `~/.claude/skills/<name>/` |
| **Codex CLI** | `~/.agents/skills/<name>/` 或项目内 `.agents/skills/` |
| **DeepSeek Harness (DSH)** | `~/.dsh/skills/<name>/` 或项目内 `.dsh/skills/` |
| **Hermes** | `~/.hermes/skills/<category>/<name>/` |

每个技能目录里都有 `SKILL.md`（frontmatter 里 `name` + `description` 是必需的）。

---

## ⚠️ 关于这里的内容

- **都是个人的小打小闹**，不是生产级产品；
- 代码里可能有**不完美、写得糙**的地方，欢迎 issue/pull request；
- **示例数据已脱敏**（人名、路径、IP 都换成了占位符），个人配置请自行替换；
- 各项目/技能的**许可证见各自目录**（大体为 MIT）。

---

## 📄 License

MIT — 见 [LICENSE](LICENSE)。

---

*由人来出点子，AI agent 负责实现。* 🫐🦞
