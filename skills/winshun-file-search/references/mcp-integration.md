# WinShun MCP 接入（给 AI 助手用）

> 来源：`docs/features.en.md` 的「AI assistants (MCP)」一节
> 官方链接：https://github.com/LingCore/WinShun/blob/main/docs/features.en.md

---

## 一句话

**WinShun 自己就是一个 MCP server。** Claude Desktop、Claude Code、Cursor、VS Code 都能一键接上，直接搜文件名、文件内容、最近改动。

**但官方明确说了：会跑命令的 agent（Claude Code、Codex）用 `ws` 命令行比用 MCP 更省上下文。**

**⇒ 所以：**
- **能跑 shell 的 agent → 用 `ws`**（我们就是这么干的）
- **纯 GUI 客户端 / 不能跑命令的 → 走 MCP**

---

## 安全设计（官方默认）

```
① 只读            默认不给写权限
② 范围受限        只能看到 AI 客户端被允许看的部分
③ 隐藏文件夹      可设置「对 AI 保密」的目录
④ 调用日志        每次调用都留记录
```

**⇒ 这四条和我们的三区权限模型思路一致：**先只读，再按需放开，全程可审计**。**

---

## 怎么配

**方法一：动嘴（官方主推）**

对 AI 说：**「帮我配一下 WinShun」**

它会问几个问题，然后一次改好几项设置。

**⇒ 但会弹窗先问你；右下角提示改了什么，几秒内可撤销。**

**⇒ 安全相关的设置，永远会问。**

**方法二：装指令到客户端**

```bash
ws skill --install claude          # Claude Desktop / Claude Code
npx skills add LingCore/WinShun    # 其他助手（Cursor、VS Code 等）
```

**⇒ 后一个命令同时装了三个技能：**

```
① 用 ws 的说明书
② 写插件的技能
③ 改 WinShun 本体的技能
```

---

## MCP 和 ws 怎么选

| 场景 | 选 |
|---|---|
| Codex / DSH / 任何能跑 shell 的 agent | **`ws` 命令**（省上下文） |
| Claude Desktop（纯 GUI） | **MCP** |
| Cursor / VS Code（有终端） | 两者都行，**命令更省** |
| 要严格限制 AI 可见范围 | **MCP**（有「隐藏文件夹」开关） |
| 要审计每次调用 | **MCP**（有调用日志） |

**⇒ 我们的选择：直接调 `ws.exe`，不走 MCP。**

**⇒ 理由：**少一层协议、少一份上下文、出了问题能看到原始 stderr**。**

---

## 插件权限（MCP 共享同一套）

**⇒ 插件的开关和 MCP 共用同一组安全设置。**

**⇒ 三种情况会在 WinShun 自己窗口里弹窗问用户：**

```
① 某插件第一次被启用（要授权限）
② 装未审核的包（标 unreviewed）
③ 卸载插件
```

**⇒ 这时 `ws plugin install` 会返回**退出码 1**。**

**⇒ agent 必须：**告诉用户去窗口里点，绝不代答，然后 `ws plugin list` 复查**。**

**⇒ 官方 SKILL.md 原话：**"Tell the user to answer there, never answer for them."**
