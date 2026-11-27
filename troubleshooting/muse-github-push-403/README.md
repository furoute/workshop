# Muse GitHub 推送 403：连接器写操作全断

> 日期：2026-11-27｜对象：Muse GitHub 连接器（OAuth + Meta Muse AI App）｜仓库：furoute/acp-lite｜状态：未解决，已报 Muse 团队反馈

---

## 现象

- `push_files` / `create_or_update_file` 一律 403 `Resource not accessible by integration`；**读操作完全正常**。
- 当天共 9 次推送失败。
- 此前写权限是好的（2026-11-15 acp-lite 推送成功，commit `349e4b1`），11-27 才坏。

## 根因（判断）

不是仓库/安装设置问题，是**连接器/MCP 侧的问题**（待 Muse 团队确认）。

## 证据

- 安装页核实全对：Repository access = All repositories、code/issues/PRs 读写、未暂停、无待确认提示（Save 点过，无变化）；
- App 卸载重装无效；
- GitHub 连接断开重连无效：新 OAuth linked_at `1795759315`、新安装 ID `186383491`，等 3 分钟后重推仍 403；
- 读操作全程正常，排除 token 失效/账号问题。

## 修法（绕行）

推送恢复之前，建文件/改文件走 **GitHub 网页手动操作**（台式机 Chrome：Add file → Create new file / 文件页铅笔编辑）。本次 acp-lite 两个提交（`7b9f659` 建 workflow、`1cad0ac` 改一行路径）均由此完成。

## 验证

- 网页建文件、改文件均成功，workflow run #2 变绿；
- 连接器写恢复后需重测 push 再切回连接器；恢复与否等反馈结果，**不要反复重试推送**。

---

相关：[GitHub Actions 实测手记](../github-actions/)（本次试水就是在修这个 403 的过程中顺带坐实的）。
