---
name: pc-wake-and-android-control
description: Use when 需要远程唤醒关机的电脑（WoL / 魔术包 / ErP），或用 ADB + scrcpy + scrcpy-mcp 让智能体操控安卓手机（打电话、发短信、点界面）。含三条实测矩阵、七个坑、四条操作纪律。
---

# 远程唤醒电脑 + 用电脑操控安卓手机

两条线：**把机器叫醒**（WoL），**把手机接管**（ADB / scrcpy）。前者解决"想干活了机器是关的"，后者解决"想让智能体替我拨个电话"。

---

## 第一部分：电脑之间互相唤醒

三台机：**上网本**（Ubuntu，常开）、**台式机**（Win11）、**笔记本**（Ubuntu + Win11 双系统）。

![电脑之间互相唤醒：入口 → 智能插座第一跳 → 网线 WoL 第二跳](assets/wake-architecture-v3.png)

### 现在实际在跑的闭环

先讲清楚每天真正在用的那条链——不是实验，是日常：

```
① 人在手机上说话（WiFi）
        ↓
② 上网本（常开）收到，智能体接单
        ↓
③ 上网本开智能插座 → 台式机通电自启
        ↓（台式机和上网本隔一堵墙，网线拉不过去，WoL 用不上）
④ 上网本的智能体经 SSH 接过台式机
        ↓
⑤ 台式机 —— 如果那根网线插着 —— 再发魔术包唤醒笔记本
```

**第一跳为什么是插座**：上网本到台式机没有网线通路（WiFi 无法唤醒，见后文），只能靠插座断电恢复自启。

**第二跳才是 WoL**：台式机到笔记本有网线，魔术包可达。

插座负责没有网线的那一段，WoL 负责有线可达的那一段。

### 两条路的分工

| | 智能插座 + 断电自启 | 网线 WoL |
|---|---|---|
| 触发方式 | 插座通电 | 魔术包 |
| 前提 | BIOS `Restore AC Power Loss = Power On` + `ErP Ready = Disabled` | `ErP Ready = Disabled` |
| 覆盖范围 | **只能叫醒接了插座的那一台** | 同广播域内任意有线机器 |
| 需要网线吗 | 不需要 | 需要（直连或同交换机） |
| 是否依赖网线 | ✅ 不依赖，机器之间无需连线 | ❌ 必须有线且同广播域 |
| 成本 | 几十块一个 | 零（用现有的线） |

**⇒ 两条路的前提里都有 `ErP Ready = Disabled`，这是共同的坎。**

### 一、智能插座：无网线通路时用这条

**适用**：两台机器之间没有网线通路（WiFi 无法唤醒）；或目标机主板不支持 WoL。

**BIOS（台式机，华硕主板在 `Advanced → APM Configuration`）**

| 项目 | 设为 | 为什么 |
|---|---|---|
| **Restore AC Power Loss** | **Power On** | 断电再来电就自动开机，插座方案的核心 |
| **ErP Ready** | **Disabled** | 开着会把待电一起掐掉，插座也失效 |
| Power On By PCI-E | 按需 | 这是「被别人 WoL 唤醒」用的，插座方案不需要 |

⚠️ **`Power On By PCI-E` 与插座方案无关**：它是让台式机自己能被人用魔术包叫醒；插座方案是「断电恢复」，走的是另一条路。两个可以并存，不冲突。

**Windows 侧：必须关快速启动**

```powershell
$k = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power"
Set-ItemProperty -Path $k -Name HiberbootEnabled -Value 0 -Type DWord
(Get-ItemProperty -Path $k -Name HiberbootEnabled).HiberbootEnabled   # 必须回读 0
```

**快速启动开着时，「关机」其实是休眠**（把内核会话写进休眠文件），主板仍处于软关机而非 G3 —— 插座断电再上电，BIOS 的恢复逻辑根本不会触发。

**操作节奏（顺序错了就开不了机）**

```
关机（shutdown /s，不是睡眠）
  ↓ 等电源灯完全熄灭
  ↓ 再等约 10 秒（主板进入 G3）
插座断电
  ↓ 等 ≥30 秒（华硕文档：断电恢复只在 G3 稳定后生效）
插座通电
  ↓ 机器自己起来
```

**插座自身的设置**：App 里「断上电管理」必须选【开启】（有的叫「常开/通电即开」）。

| 选项 | 行为 | 能不能用 |
|---|---|---|
| **开启** | 每次通电都输出 | ✅ 只能选这个 |
| 记忆 | 延续断电前状态 | ❌ 实测出现过不给电 |
| 关闭 | 每次通电都不输出 | ❌ 主板收不到 AC 恢复 |

**踩过的坑**

| 现象 | 原因 | 处理 |
|---|---|---|
| 插座灯亮、App 在线，机器纹丝不动 | 输出口没电（选了「记忆」档） | 先看插座灯/输出，再进 BIOS |
| 断电太急，下次不启动 | 关机瞬间硬切，系统被判「异常断电」 | 等电源灯全灭 + 10 秒再断 |
| 来电后机器不自动起 | 快速启动没关 / 断电时间不够 / BIOS 没保存 | 按顺序排查，别先怀疑插座 |

**判「异常断电」的办法**（目标机事件日志）：

```powershell
Get-WinEvent -FilterHashtable @{LogName='System'; ID=41,1074,6008} -MaxEvents 6 |
  Select-Object TimeCreated,Id
```

`1074` = 正常关机 ✅ ｜ `41` = 未正常关机情况下断电 ❌

**插座是应急开关，不是日常开关**：一直通电时再点一次「开」什么都不会发生——BIOS 监听的是「掉电后重新上电」这一跳变，不是电平。平时直接按机箱电源键开关机，要远程开机才断电。

### 二、网线 WoL：有线可达时用这条

**结论先说**

```
唯一前提   接收方 BIOS 里 ErP Ready = Disabled
次要条件   笔记本必须插着电源（电池供电时网卡会断电）
发送方     谁在线谁发，用什么设备都行
网络       同一广播域即可——直连、过 Hub、过交换机都通
```

#### 实测矩阵（2026-11-11，四条全通）

| 发送方 | 接收方 | 连接方式 | 结果 |
|---|---|---|---|
| 笔记本 | 台式机 | 网线直连 | ✅ |
| 上网本（USB 转网口） | 台式机 | 网线直连 | ✅ |
| 上网本（USB 转网口） | 台式机 | 经路由器 LAN 口 | ✅ |
| 台式机 | 笔记本 | 网线直连 | ✅ |
| 上网本（USB 转网口） | 笔记本 | 网线直连 | ✅ |
| 上网本（USB 转网口） | 笔记本 | 经路由器 LAN 口 | ✅ |

失败的只有一种：**笔记本自己不插电源**——网卡跟着断电，怎么发都收不到。

#### 配置三步

**① 接收方 BIOS：关掉 ErP**

进 BIOS（华硕：关机状态按住 F2 再按电源键，F7 进高级模式）：

| 项目 | 设为 | 说明 |
|---|---|---|
| **ErP Ready** | **Disabled** | 唯一必要条件。开着它，关机后网卡彻底断电 |
| Network Stack | 可开可关 | 只管 PXE 网络引导，实测与 WoL 无关 |
| IPv4 / IPv6 PXE | 建议关 | 关掉开机就不会卡在网络引导上 |
| Power On By PCI-E | Enabled | 台式机主板上的项，笔记本一般没有 |

**② 接收方系统：把网卡设成监听魔术包**

Linux：

```bash
sudo ethtool -s eno2 wol g
sudo ethtool eno2 | grep Wake-on     # 应显示 Wake-on: g
```

持久化（NetworkManager，否则重启就丢）：

```bash
nmcli connection show                 # 找到有线连接名
sudo nmcli connection modify "<连接名>" ethernet.wake-on-lan magic
```

Windows：

```
关快速启动    电源选项 → 选择电源按钮的功能 → 更改当前不可用的设置 → 取消"启用快速启动"
允许唤醒      设备管理器 → 网卡 → 属性 → 电源管理 → 勾"允许此设备唤醒计算机"
驱动开关      同一窗口"高级" → Wake on Magic Packet = Enabled
```

> 快速启动开着时，「关机」其实是休眠，WoL 会失效。这一项必须先关。

**③ 发送方：发魔术包**

```bash
# 有的发行版带这个命令
wakeonlan 60:cf:84:70:a5:c1

# 没有就用 Python，绑到指定网卡
python3 -c "
import socket, struct
MAC = bytes.fromhex('60cf8470a5c1')
PKT = b'\xff'*6 + MAC*16
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
s.setsockopt(socket.IPPROTO_IP, 8, 1)          # IP_PKTINFO
idx = socket.if_nametoindex('eno2')
cmsg = [(socket.IPPROTO_IP, 8, struct.pack('i4s4s', idx, b'\x00'*4, b'\x00'*4))]
for _ in range(10):
    for port in (9, 7):
        s.sendmsg([PKT], cmsg, 0, ('192.168.0.255', port))
print('sent')
"
```

#### 怎么判断"到底有没有待电"

不用翻日志，看两个信号就够：

```
网口灯亮 + 链路 10Mb/s      → 网卡在低功耗待电，可以唤醒
网口灯亮 + 链路 1000Mb/s    → 全速待电（有些网卡省电策略不同），也可以
灯灭 / 链路 Disconnected    → 断电了，发什么都没用
```

实测中，**向待电网卡发一个包，链路会立刻从 10M 跳回 1G**——这就是"网卡醒了"的信号，比等 ping 通快得多。

#### 原理：为什么关机还能收包

正常关机是 **S5 软关机**：CPU、内存、硬盘都停了，但主板仍给网卡留一路 +3.3V 待机电，网卡以最低功耗持续监听网线。

唤醒靠**魔术包**（Magic Packet），结构固定：

```
FF FF FF FF FF FF          ← 6 字节同步流
+ 目标 MAC × 16 次          ← 连重复 16 遍
共 102 字节
```

网卡在待电监听中一旦认出这个模式，就向主板发一个 **PME**（电源管理事件）信号，主板随即加电开机。

**全程不需要操作系统参与**——系统还没起来，网卡自己就能认包、触发开机。这就是为什么"改 Windows 设置"对 Linux 机器毫无意义，也是为什么"换哪个系统启动"不影响能否被唤醒。

#### 为什么必须同一广播域

WoL 工作在**第二层**，不用 IP。关机的机器没有 IP，路由器也认不出它，所以魔术包走**二层广播**：

```
以太网帧发到 FF:FF:FF:FF:FF:FF
或 UDP 发到 255.255.255.255 / 192.168.0.255，端口 7 或 9
```

同一广播域内所有网卡都收到，但只有 MAC 跟包里重复 16 次那个一致的才响应——广撒网、精匹配。

**所以：**

| 场景 | 能否唤醒 |
|---|---|
| 直连、过 Hub、过交换机（同一 VLAN） | ✅ |
| 跨 VLAN、跨网段、跨路由器 | ❌ 广播过不去 |
| 无线发（WoWLAN） | ❌ 消费级基本不可用 |

想跨网段唤醒，得配定向广播、或先 VPN 回目标局域网、或在目标局域网里放一台常开中继转发。

#### 为什么是 ErP（欧盟能源法规）

ErP 是欧盟《能源相关产品指令》（Energy-related Products Directive），现行版本 **(EU) 2023/826**，2025-05-09 起强制实施。它给设备的关机、待机、网络待机功耗划了上限：

| 模式 | 2025-05-09 起 | 2027-05-09 起 |
|---|---|---|
| 关机模式 | 0.50 W | 0.30 W |
| 待机（无状态显示） | 0.50 W | 0.50 W |
| 待机（有状态显示） | 0.80 W | 0.80 W |
| 网络待机（无 HiNA） | 2.00 W | 2.00 W |
| 网络待机（有 HiNA） | 8.00 W | 7.00 W |

BIOS 里开 ErP，就是切断 USB、PCIe 插槽、网卡等外设的待机供电，把关机功耗压到 0.5W 以下。

**代价：** 网卡彻底没电，听不到魔术包，远程唤醒全部失效。

**关掉 ErP：** 主板持续给网卡供待机电压，关机功耗升到 1.5W 上下。

> **这不是故障，是取舍**：要远程唤醒，就得接受多耗这点电；想极致省电，就放弃远程唤醒。

### 踩过的坑

| 现象 | 原因 | 处理 |
|---|---|---|
| 关机后网口灯灭，怎么发都不行 | ErP 开着 | 进 BIOS 关掉 |
| 笔记本拔了电源就唤不醒 | 电池供电时厂家切断网卡待电 | 插着电用 |
| 网卡设了 `wol g`，重启又变回 `d` | 没持久化 | nmcli 里配 `wake-on-lan magic` |
| Windows「关机」后叫不醒 | 快速启动开启，「关机」其实是休眠 | 关掉 `HiberbootEnabled` |
| 魔术包发出去了，机器不醒 | 发送走了默认路由（比如 WiFi），没从目标网段的网卡出去 | 绑接口发送（`IP_PKTINFO` / `SO_BINDTODEVICE`） |
| 合上盖子唤醒后，屏幕亮一下又灭 | 系统检测到合盖，进了睡眠 | 要长期合盖运行，改 `logind.conf` 的 `HandleLidSwitch` |
| 开机后卡在 PXE 网络引导 | 网络启动被设成第一启动项 | BIOS 里调回硬盘优先 |

---

## 第二部分：用电脑操控手机

**为什么值得做：** 手机上的事（打电话、发短信、设闹钟、点某个 App 里的按钮）原本只能人手动来。接上调试通道之后，智能体就能接手——不是"教它点屏幕"，而是给它一套结构化的工具。

### 安卓能做，苹果难做

本文写的是**安卓**：ADB 是官方开放接口，USB 授权之后电脑能直接驱动设备，所以这套方案稳、可复现。

**iPhone 走不通同一条路。** iOS 没有对外的 ADB 等价物，控制链路只能靠：

```
XCTest / WebDriverAgent    苹果官方的 UI 自动化框架，需要 macOS + Xcode 签名部署
无障碍 / 投屏镜像            部分工具走 AirPlay 镜像 + 模拟点击，能力受限
云端真机农场                 租用远程 iPhone，按次计费
```

门槛差异很实在：**安卓一台 Windows 笔记本就能全套跑通；iOS 基本绕不开一台 Mac。** 如果手上只有 iPhone，短期内别指望复刻本文这套方案。

想横向看这个领域的工具选型，推荐这份开源手机智能体横评：

- 中文版：<https://personalagentbench.com/zh-cn/phone-use/>
- 英文版：<https://personalagentbench.com/phone-use/>

它覆盖 iPhone、安卓、无障碍、ADB、云端手机、确认机制、遥测与许可差异，共 11 款工具；中文页是机器翻译，有出入以英文页为准。

### 架构

![ADB 手机控制架构：用户 → Codex → scrcpy-mcp → ADB Server → 手机上的 adbd / scrcpy-server](assets/adb-architecture-v3.png)

```
用户侧   语音/文字意图，实时看屏幕
控制侧   Codex 经 MCP stdio 驱动 scrcpy-mcp，再用 adb 对接本地 ADB Server
手机侧   USB + RSA 授权；adbd 收命令，scrcpy-server 用 MediaCodec 编 H.264
```

### 三件套

```
scrcpy + ADB    投屏与设备控制（Windows: winget install --exact Genymobile.scrcpy）
Node.js 24+     scrcpy-mcp 的运行环境
scrcpy-mcp      把 ADB 包成 MCP 工具，智能体直接调用
```

注册后要**重启 Codex 或新开会话**，旧任务拿不到新工具。

### 前置：USB 调试

```
① 开发者选项 → 打开 USB 调试
② 数据线必须能传数据，不是纯充电线
③ 解屏，手机上点"允许"RSA 授权，勾"始终允许"
④ adb devices -l 应显示 device
```

`unauthorized` 要手机点授权，`offline` 重连 USB 或重启 ADB 服务。

### 智能体能干什么

| 能力 | 做法 | 注意 |
|---|---|---|
| 投屏 / 截图 | `scrcpy -s <serial>`、`screencap` + `pull` | 判断当前在哪个界面 |
| 点按 / 输入 | `uiautomator dump` 取节点 → 按 bounds 算坐标 | 屏幕一变就重新 dump |
| 启动 App | `app_start` / `am start` | 先用计算器这类无害应用做冒烟 |
| **打电话** | `am start -a android.intent.action.DIAL -d tel:<号码>` | 先填号，或点对应 SIM 的拨号键 |
| **发短信** | `am start -a android.intent.action.SENDTO -d sms:<号> --es sms_body '<内容>'` | 默认只填草稿；发送前核对收件人和正文 |
| 闹钟 / 计时 | 时钟 App 的 UI 操作 | 每个开关单独验，UI 只显示下一个待触发 |
| 双卡识别 | `dumpsys isub` 查 subId / simSlotIndex / 运营商 | 别凭外观猜卡槽 |

### 四条纪律

```
① 绝不绕锁屏    密码、PIN、图案、生物识别都不碰，需要时请人解
② 外发要确认    短信、电话、上传、删除、安装——发之前核对目标
③ 坐标不缓存    屏幕一变旧坐标作废，必须重新 dump UI
④ 隐私要脱敏    号码、短信内容、通话记录，非必要不展示
```

**ADB 给的是能力，纪律决定它靠不靠谱。**

常见故障：`unauthorized` 要手机点授权；锁屏后控制失效是硬边界，叫人解锁；MCP 工具看不到就重启会话；多台设备所有命令加 `-s <serial>`；UI dump 失败多半是息屏或锁屏。

---

## 附：本文的边界

- **WoL 部分**全部为 2026-11-11 实机验证，三台机器型号与 ISP 设备无关，方法通用。
- **手机部分**基于 `furoute/workshop` 的 `android-adb-scrcpy` 技能，架构图不含具体机型、系统版本、账号或网络地址，适用于任何安卓手机。
- 涉及 BIOS 改动、系统配置改动、需要 root 的操作，均应在动手前确认，不在自动化流程里默认执行。
