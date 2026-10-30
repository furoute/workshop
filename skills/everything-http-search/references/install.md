# Everything 安装与常驻配置（完整步骤）

> `SKILL.md` 只留结论，这里是可照抄的完整命令。

## 一、两个核心开关 + 一个 HTTP 开关

#### ① 两个核心开关 + 一个 HTTP 开关（先关 Everything，改完再启）

```ini
run_in_background=1     ← 「界面→后台运行(B)」：点 × 不退出
show_tray_icon=1        ← 「界面→显示托盘图标(I)」：有图标才叫得出窗口
http_server_enabled=1   ← HTTP 服务（跟界面页无关，ini 里设置）
http_server_port=8089
http_server_bindings=127.0.0.1
```

**这三样齐了，点 × 就自动进托盘、HTTP 一直在、随时能用。** 不需要额外配 `minimize_to_tray`。

> **真正必须成对的只有两个，而且都在「界面」页里：**
>
> | ini 键 | 图形界面（工具 → 选项 → 界面） | 缺了会怎样 |
> |---|---|---|
> | `run_in_background=1` | **后台运行(B)** | 点 × **直接退出**，HTTP 服务跟着没 |
> | `show_tray_icon=1` | **显示托盘图标(I)** | 程序还在跑，**但没图标可点** → 人再也叫不出窗口 |
>
> 这两个勾上以后，点 × 会自动收到托盘（不需要另外的"最小化到托盘"选项——Everything 1.4 的
> 界面页里根本没有这一项）。HTTP 服务是 ini 里 `http_server_enabled=1` 控制的，跟界面页无关。
>
> **最坑的是「后台运行勾了、托盘图标没勾」**：程序确实在跑、HTTP 也通、agent 查得到，
> 但人手上完全看不见它——想改个设置、想手动搜一下，**没有任何入口**，
> 再双击 exe 还会报「进程已被占用」，只能去任务管理器杀进程。
>
> ⚠️ **更正**：早期版本本文写过 `minimize_to_tray=1` 要放进"一个不能少"的组合，那是错的——
> 界面页里没有这一项，`minimize_to_tray` 是 ini 里存在的键但不该当成配置步骤讲。
> `minimized=1` 只影响"启动时是否最小化"，可以用，但它不是防"退回后台"的开关。


## 二、开机自启

### 开机自启：图形界面里没有这一项

Everything **界面的选项页里没有"开机启动"开关**（便携版尤其没有）。要开机自启，两条路：

**① 放启动文件夹（推荐，最直观）**

```powershell
$exe = "<Everything目录>\Everything.exe"
$lnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Everything.lnk"
$ws  = New-Object -ComObject WScript.Shell
$s   = $ws.CreateShortcut($lnk)
$s.TargetPath = $exe; $s.WorkingDirectory = Split-Path $exe
$s.Arguments = "-startup"
$s.WindowStyle = 7
$s.Save()
```

**② 装成服务的安装版**：安装版在 `工具 → 选项 → 常规` 里有"随 Windows 启动"，便携版没有。

> 想确认到底起没起：`Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"`


## 三、进程被占用的三步修复

#### ⚠️ 配完这两项，最容易撞上的「进程被占用」

**症状**：勾了「后台运行」但没勾「显示托盘图标」→ 点了 × 之后程序**看不见但还在跑**。
然后去双击 `Everything.exe` 想重新打开，弹「**进程已被占用**」——想改设置都没入口。

**根因**：旧实例还占着单实例锁，新实例起不来，而旧实例又没有 UI 可以点。

**三步修复（不需要重启机器）：**

```powershell
# ① 杀掉所有残留实例（这一步解决"被占用"）
Get-Process Everything -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
(Get-Process Everything -ErrorAction SilentlyContinue | Measure-Object).Count   # 应为 0

# ② 改 ini 四键（先关程序再改，否则退出时会回写旧值）
$ini = "<Everything目录>\Everything.ini"
Copy-Item $ini "$ini.bak" -Force
$t = Get-Content $ini -Encoding UTF8
$t = $t -replace '^show_tray_icon=0$',     'show_tray_icon=1'
$t = $t -replace '^run_in_background=0$',  'run_in_background=1'
$t = $t -replace '^http_server_enabled=0$','http_server_enabled=1'
$t | Set-Content $ini -Encoding UTF8

# ③ 重新启动
Start-Process "<Everything目录>\Everything.exe" -ArgumentList "-startup","-minimized"
```

**关键顺序：先杀进程 → 再改 ini → 再启动。** 顺序反了会被回写覆盖，等于白改。

**验证**：`Get-Process Everything` 有进程、`MainWindowHandle=0`、8089 监听 1 条、
托盘区能看见图标、右键图标能呼出窗口。


配套已有的 `http_server_enabled=1` / `http_server_port=8089` / `http_server_bindings=127.0.0.1`。

#### ② 在启动文件夹放个快捷方式（比 schtasks 更适合开机自启）

```powershell
$exe = "C:\path\Everything.exe"
$lnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Everything.lnk"
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnk)
$s.TargetPath = $exe
$s.WorkingDirectory = Split-Path $exe
$s.Arguments = "-startup -minimized"   # ← 关键是 -minimized
$s.WindowStyle = 7                     # 最小化窗口
$s.Save()
```

> **为什么用启动文件夹而不是 schtasks**：schtasks 的 `/sc ONLOGON` 也能自启，但启动文件夹更直观、用户能在"启动"里看见、出问题好排查。`/it` 那个用法只适合**临时**从 SSH 拉起来，不适合常驻。

#### ③ 验证（重启后）

```powershell
Get-Process Everything                                    # 有进程
Get-NetTCPConnection -LocalPort 8089 -State Listen        # 1 条
(Get-Process Everything).MainWindowHandle                 # 0 = 无窗口，在托盘
(Get-Content Everything.ini) | Select-String "run_in_background=1"   # 1 = 点×不退出
Invoke-WebRequest "http://127.0.0.1:8089/?search=test&json=1" -UseBasicParsing  # 200
```

**实测**：重启后 **1–4 分钟**就绪（热重启约 1.5 分钟，智能插座冷启动约 4 分钟，视磁盘和负载而定）；`MainWindowHandle=0`（真静默），8089 可查。

