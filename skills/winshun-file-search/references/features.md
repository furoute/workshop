# WinShun 能力全表（官方文档摘要）

> 来源：`docs/features.en.md`（官方英文文档）
> 官方链接：https://github.com/LingCore/WinShun/blob/main/docs/features.en.md
> 摘要翻译，细节以官方为准。

WinShun 不只是文件搜索，它是一整套 Windows 启动器 + 效率工具。下面按官方章节顺序列，**标 ★ 的是和 agent 有关的**。

---

## 1. File search（文件搜索）

- 双击 Ctrl 唤起，输入即搜，毫秒级
- 支持**拼音 / 首字母**（`bg`、`baogao` → 报告）
- 支持通配符 `*.pdf`、排除 `!word`、`ext:pdf,docx`、路径限定 `folder\name`
- 结果可按 newest / name / largest 排序

## 2. Full-text search（全文搜索）★

- 建索引后能搜 **Word / Excel / PowerPoint / PDF 里的文字**
- 命令行对应 `ws grep`
- 命中格式带位置：`p3`（第 3 页）、`s2`（第 2 张幻灯片）、`[Sheet1]r12`（第 12 行）
- 支持 `"a|b"` 任一匹配；`regex:` 前缀走正则

## 3. Apps and settings（应用与设置搜索）

- 搜已安装程序、系统设置项，回车直接打开
- 相当于「开始菜单 + 设置」的统一入口

## 4. Web search（网页搜索）

- 输入关键词可直接跳搜索引擎
- 可配多个搜索引擎，前缀切换

## 5. Favorites（收藏 / 快捷方式）

- 常用文件、文件夹、命令固定到首屏

## 6. Plugins（插件）★

- `ws plugin list / search / install / enable / disable / remove`
- 插件库里有翻译、OCR、截图等
- **首次开某插件的权限，WinShun 会在自己窗口里弹窗问用户** —— agent 不能代答

## 7. Open and Save dialogs（打开/保存对话框增强）

- 在任意程序的「打开文件」对话框里也能用 WinShun 搜
- 不用先退出去找文件

## 8. In File Explorer（资源管理器内）

- 在资源管理器里直接调用搜索

## 9. Clipboard history（剪贴板历史）

- 替代 Win+V，保留历史条目
- 命令行 `ws clip -n 5` 可读
- **默认可能需要用户授权**

## 10. Screenshots and recording（截图与录屏）

- 内置截图、录屏、贴图
- 可 OCR 取字

## 11. Taskbar search box（任务栏搜索框）

- 把搜索框放到任务栏

## 12. AI assistants (MCP) ★★

**官方原话要点：**

- **WinShun 本身就是一个 MCP server**
- Claude Desktop / Claude Code / Cursor / VS Code 可以一键连接
- 能搜文件名、文件内容、最近改动

**安全设计（重要）：**

```
① 默认只读
② 限制在 AI 客户端能看到的范围
③ 可以设置「对 AI 隐藏的文件夹」
④ 有调用日志
```

**配置方式：** 对 AI 说「帮我配一下 WinShun」，它会一次改好几项设置 —— **但会弹窗先问你**，右下角还有提示和几秒内的「撤销」。

**命令行 `ws`：**

> 官方明确写了：**会跑命令的 agent（Claude Code、Codex）用 `ws` 比用 MCP 更省上下文。**

**装指令到各个 AI 客户端：**

```bash
ws skill --install claude        # 装到 Claude
npx skills add LingCore/WinShun  # 其他助手
```

## 13. Looks and settings（外观与设置）

- 深色/浅色、圆角、字体等

## 14. winshun:// links（自定义链接）

- 可以用 `winshun://` 协议从别处唤起搜索

## 15. Keys（快捷键）

- 默认双击 Ctrl；可改为单键组合
- **冲突时要改**（比如和 Everything 的全局热键）

---

## 对 agent 最有用的四条

```
① ws grep       搜文档正文，Everything 做不到
② ws text       直读 docx/xlsx/pptx/pdf 纯文本
③ ws find       拼音/首字母找中文文件名
④ MCP           一键接 Claude/Cursor/VS Code（官方支持）
```

**⇒ 官方自己说：能跑命令的 agent 用 `ws` 比 MCP 省上下文。**

**⇒ 这正好印证我们的选择：直接调 `ws.exe`，不走 MCP。**
