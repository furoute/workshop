# DSH 桌面版升级：配置字段会「反过来」咬你

> **一句话**：升级后起不来，多半是 `cordis.patch.yml` 里的某个字段在新版语义变了。
> **上一个版本的正确修法，下一个版本可能就是致命错误。**
>
> 实测版本：DSH 桌面版 `0.2.1-rc.2` → `0.2.2-rc.1`（Windows 11）

---

## 症状

启动弹框：

```
DeepSeek Harness 无法使用
应用无法启动或已意外停止。

agent-loop (required)          tools
tool-working-directory         tools
timeout-policy                 tools
...
```

弹窗给了四个按钮，其中一个叫 **「禁用第三方插件、备份 profile patch 并重启」**。

**⚠️ 别点它。** 它会把 `cordis.patch.yml` 重建成极简版，自研插件的 insert 段会被整段清空 ——
表现就是「插件全没了」。真正要改的往往只有一两行。

---

## 定位：真错误在前 5000 字符，不在末尾

```
%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-<ISO时间>-host.log
```

文件结构大致是：

```
time / source / phase / app 版本 / platform     ← 头几行
--- error ---
DesktopHostFatalError: dsh: startup failed: N required plugins did not activate
Failed plugins (N): ... ValidationError / Error  ← 真错误在这里（前 5000 字符内）
Plugins waiting for services (M): ...
--- renderer console ---
--- auxiliary diagnostics ---
插件清单（几百行 JSON）                          ← 末尾几千字，别在这找
```

只读前 5000 字符就够定位。

---

## 根因：同一个字段，三版三种规矩

### `tools.mode`

| 版本 | 合法值 | 升级后要做什么 |
|:--|:--|:--|
| 0.2.0 及更早 | `native` / `ptc` / `both` | — |
| 0.2.1-rc.2 | `native` / `ptc`（`both` 报错） | 把 `both` 改成 `native` |
| **0.2.2-rc.1** | **只能不写（null）** | **把整段 `- id: tools / config` 删掉** |

报错原文：

```
ValidationError: invalid config:
  - $.mode expected nullable but got native (at mode)
```

`expected nullable` = 这个字段只接受空值。

**这就是最容易踩的地方**：上一轮为了修 `both` 报错，我们主动把 `mode: native` 写进了补丁层。
下一版升级，这段「正解」直接变成致命错误。

### `llm-deepseek-account.models`

```
Error: models is no longer configurable; the account /models listing supplies the catalog.
       Remove models from this entry and adjust single models with modelOverrides.<model id>
```

新版模型目录由账号 `/models` 接口实时拉取，配置里不能再写。

**注意：`models: []`（空数组）一样报错** —— 校验用的是 `Object.hasOwn`，键存在就检查。

替代写法：

```yaml
- id: llm-deepseek-account
  name: '@deepseek-ai/dsh-llm-deepseek-account'
  config:
    modelOverrides:          # 只能覆盖已有模型，不能新增
      deepseek-flash:
        contextWindow: 524288
        maxTokens: 131072
```

只想用内置目录 → 整段 `models` 删掉，什么都不用写。

---

## 修法

### 1. 删掉 `tools.mode`（三个 profile 都要）

```powershell
foreach ($p in @('desktop','web','headless')) {
  $f = "$env:USERPROFILE\.dsh\profiles\$p\cordis.patch.yml"
  Copy-Item $f "$f.bak-before-rc1-$(Get-Date -f yyyyMMdd-HHmmss)" -Force
  # 手工删掉 "- id: tools / config: / mode: xxx" 整段（含上方注释）
}
```

验证：

```powershell
Select-String -Path "$env:USERPROFILE\.dsh\profiles\*\cordis.patch.yml" -Pattern '^- id: tools'
# 应该无输出
```

> **别用 `grep 'mode:'` 判断。** headless 里有 `- id: sandbox-policy` 的
> `mode: danger-full-access`，那是另一回事，会误命中。用 `^- id: tools` 判断。

### 2. 确认能启动

```powershell
taskkill /F /IM "DeepSeek Harness.exe" /T
schtasks /run /tn "DSH_Launch"      # 或直接双击
Start-Sleep 40
(Get-Process 'DeepSeek Harness' -ErrorAction SilentlyContinue).Count   # 期望 4-6
```

崩溃日志文件名时间戳不再往后走 = 启动成功。

### 3. 如果插件已经被清空：从备份捞回 insert

```powershell
Get-ChildItem "$env:USERPROFILE\.dsh\profiles\desktop" -Filter 'cordis.patch.yml*'
```

挑最近一份完整版（体积大的那个），把 `- insert:` 开头的段合并回来。

**只搬 `- insert:` 段**，不要连带 `- id: tools` / `llm-deepseek-account` 一起搬，
否则又踩回同一个坑。

### 4. 可选：清掉重复的模型分组

模型下拉出现两组同内容（「DeepSeek 账号」+「DeepSeek」）时：

```yaml
- id: llm-deepseek-account
  disabled: true
```

只影响 desktop 档；headless 是另一套 profile，凭据通道不受影响。

---

## 验证清单

| # | 检查 | 期望 |
|:--|:--|:--|
| 1 | 桌面进程数 | 4-6 |
| 2 | 崩溃日志 | 无新增 |
| 3 | 补丁里 `- id: tools` | 0 处 |
| 4 | 自研插件 | 侧边栏都在 |
| 5 | 模型下拉 | 无重复分组 |
| 6 | `dsh --profile headless "只回复两个字：正常"` | 返回「正常」 |

---

## ★ 走过的弯路

| 查过 / 做过什么 | 结论 | 为什么是弯路 |
|:--|:--|:--|
| 以为是 `DSH_TOOLS_MODE` 环境变量老毛病 | **不是** | User / Machine / 进程三处全是 null |
| 照上一版文档把 `mode` 改成 `native` | **反而更错** | 那正是本次报错原因 |
| 想当然「桌面版起不来，CI 肯定也起不来」 | **错** | headless 是独立 profile，实测 3.6 秒回话 |
| 点了「禁用第三方插件」按钮 | 插件全丢 | 它会重建 patch；应该直接改那两行 |
| 在崩溃日志末尾找错误 | 找不到 | 真错误在前 5000 字符 |
| 用 `grep 'mode:'` 判断清干净没 | 误判 | 会被 `sandbox-policy.mode` 命中 |

**其中第三条最值得记**：桌面版坏了先跑一条 headless 验证，能用就让 agent 自己查自己，
不能用才从外部接手。代价 3 秒，省下十几分钟重复排查。

---

## 遗留

- `subagent-codex` / `computer-use` 仍是 `0.2.1-rc.2` 的包，宿主是 `0.2.2-rc.1`
  （peer 要求 `cordis ~4.0.5`，实际 `4.1.0`）。静态 API 核对通过、实测能启动，
  但属于**兼容性侥幸**，下次升级要重新验证。
  其中 `computer-use` 是独占注册服务，原生驱动崩溃可能直接终止宿主进程。
- `ui-settings-general.welcomeNoticeVersion` 必须精确等于当前版本号，写旧值会让欢迎提示重新弹出。

---

## 给下一次的一句话

```
升级后起不来 → 读崩溃日志前 5000 字符 → 看 ValidationError 说哪个字段
            → 这个字段在新版是「换了合法值」还是「整个废了」
               换值的 → 改值
               废了   → 整段删
            → 重启，再看日志有没有新增
```

**不要沿用上一个版本的修法。版本号变了，字段语义就可能反过来了。**

---

## 相关

- 详细版（含实测时间线、备份文件名、完整处置记录）见个人仓库 `furoute/dsh` 的 `docs/`
- 同类经验：Agent 的配置文件里写进去的「兼容值」，应该带上版本注释，
  下次升级时优先复核这些地方
