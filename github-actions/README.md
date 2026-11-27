# GitHub Actions 实测手记：acp-lite 自测上云 + 踩坑全记录

> 2026-11-27，绒毛（muse-cloud）实测。起因：fu 前一晚问短视频里的 daily_stock_analysis 项目靠不靠谱，顺带问起 GitHub Actions 是什么、对舰队有什么用。当天在 furoute/acp-lite 上做了第一次试水：加一个 workflow，让 GitHub 的云主机每次 push 都自动跑自测。
>
> 本篇是 workshop 版（技术细节版），舰队内介绍版见 ACP 专属区 `docs/GitHub-Actions-介绍-20261127-muse-cloud.md`。

---

## 1. GitHub Actions 是什么

一句话：**GitHub 免费提供的云端任务器**。

- 在仓库里放一个 `.github/workflows/*.yml`，写好触发条件和步骤；
- 触发条件可以是 push、PR、定时（cron 表达式）、手动点 Run workflow；
- 触发后在 GitHub 的云主机（runner，如 `ubuntu-latest`、`windows-latest`）上跑，**不占自家任何一台机器**；
- 免费额度：**公开仓库免费**；私有仓库免费账号每月 2000 分钟；单个 job 最长 6 小时，跑完就停。

对舰队的意义：上网本资源紧（4C8G）、台式机常关、Muse 的 VM 会被回收——Actions 是舰队之外的免费“第七台机器”，适合做**线上自动检查**（跑测试、lint、secret 扫描、定时巡检），但它够不着内网，**替代不了 ACP、Syncthing、SSH**，也不能当 7×24 值班机。

---

## 2. 本次实测：acp-lite 自测上云

**仓库**：furoute/acp-lite（公开仓）
**加的文件**：`.github/workflows/selftest.yml`
**触发条件**：每次 push 到 main、每次 PR 到 main、手动 workflow_dispatch

### 2.1 workflow 全文

```yaml
name: selftest

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  selftest:
    name: acp-lite 自测
    runs-on: ubuntu-latest
    steps:
      - name: 检出
        uses: actions/checkout@v4

      - name: 装 Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: 装 cryptography（自测签名路径必需，缺了开局即红）
        run: pip install cryptography

      - name: 跑 selftest.py
        run: python scripts/selftest.py
```

跑的内容：`scripts/selftest.py` 用两个假机器模拟跨主机场景，验 81 项——身份指纹、带外信任、投递、幂等去重、回信跳数、过期即拒、未信任拒收、出口闸门、STOP 刹车等。

### 2.2 两次运行结果

| Run | 提交 | 结果 | 耗时 | 说明 |
|-----|------|------|------|------|
| selftest #1 | `7b9f659` | ❌ 失败 | 12 秒 | workflow 里路径写错：`python selftest.py`，但脚本实际在 `scripts/` 下；检出、装 Python 3.12、装 cryptography 三步全绿 |
| selftest #2 | `1cad0ac` | ✅ 成功 | 25 秒 | 改成 `python scripts/selftest.py` 后变绿 |

**本地复核**：把仓库原版的 `scripts/acp.py`（VERSION 0.7.1）+ `scripts/selftest.py` 拉下来实跑，**通过 81 项，失败 0 项，跳过 1 项**，与云端结果一致。

**现状**：workflow 已生效，acp-lite 每次 push/PR 到 main 都会自动跑自测。

---

## 3. 踩坑清单（抄作业前先看）

1. **路径按仓库实际结构写**。acp-lite 的代码全在 `scripts/` 下，根目录只有文档。本次首跑红就是因为写成了 `python selftest.py`。抄之前先看一眼仓库的目录树。
2. **依赖要先装**。裸环境没有 `cryptography`，自测第一步就失败。`pip install` 那步不能省。
3. **Node.js 20 弃用警告**。`actions/checkout@v4` 与 `setup-python@v5` 会报一条警告：Node.js 20 已弃用，被强制用 Node.js 24 运行。仅警告，不影响成功。
4. **密钥别写进 YAML**。需要 token/key 时填仓库 Settings → Secrets and variables → Actions，workflow 里用 `${{ secrets.NAME }}` 引用。
5. **免费额度与时长上限**。公开仓免费、私有仓每月 2000 分钟、单 job 最长 6 小时。别拿它当常驻服务跑。
6. **够不着内网**。云主机在 GitHub 的机房，不在家里局域网：碰不到 Syncthing 文件、SSH、家里服务。线上检查归它，内网活还得舰队自己干。

---

## 4. 顺带踩的坑：Muse 的 GitHub 推送 403

本次试水还顺带坐实了一个问题：Muse 的 GitHub 连接器写操作目前是断的（`push_files` / `create_or_update_file` 一律 403，读正常），OAuth 重授、App 重装、断开重连全试过均无效，已报 Muse 团队反馈。完整排障记录（现象 → 根因 → 证据 → 绕行 → 验证）已归置到 workshop 的故障排查区：

- [Troubleshooting · Muse GitHub 推送 403](../troubleshooting/muse-github-push-403/)

绕行办法一句话：推送恢复之前，建文件/改文件走 GitHub 网页手动操作。本次两个提交（`7b9f659`、`1cad0ac`）都是这么完成的。

---

## 5. 链接

- workflow 文件：https://github.com/furoute/acp-lite/blob/main/.github/workflows/selftest.yml
- 变绿的 run #2：https://github.com/furoute/acp-lite/actions/runs/45950903794
- 失败的 run #1（路径写错，供对照）：https://github.com/furoute/acp-lite/actions/runs/45950133538
- acp-lite 仓库：https://github.com/furoute/acp-lite
