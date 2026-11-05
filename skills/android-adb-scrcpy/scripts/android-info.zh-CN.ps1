[CmdletBinding()]
param(
    [string]$Serial
)

$ErrorActionPreference = "Stop"

function Resolve-Adb {
    $command = Get-Command adb.exe -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    $wingetRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    if (Test-Path $wingetRoot) {
        $candidate = Get-ChildItem $wingetRoot -Filter adb.exe -Recurse -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1
        if ($candidate) {
            return $candidate.FullName
        }
    }

    throw "未找到 adb.exe。请使用 WinGet 安装 scrcpy，或把 Android platform-tools 加入 PATH。"
}

$adb = Resolve-Adb
$deviceOutput = & $adb devices -l
$deviceOutput

$devices = @()
foreach ($line in $deviceOutput) {
    if ($line -match '^(?<serial>\S+)\s+(?<state>device|unauthorized|offline)\b(?<details>.*)$') {
        $devices += [pscustomobject]@{
            Serial = $Matches.serial
            State = $Matches.state
            Details = $Matches.details.Trim()
        }
    }
}

if ($devices.Count -eq 0) {
    throw "未检测到安卓设备。请检查 USB 数据线、USB 模式和 USB 调试。"
}

if ($Serial) {
    $target = $devices | Where-Object Serial -eq $Serial | Select-Object -First 1
    if (-not $target) {
        throw "adb devices 中未找到序列号 '$Serial'。"
    }
} elseif ($devices.Count -eq 1) {
    $target = $devices[0]
} else {
    throw "检测到多台设备，请使用 -Serial <序列号> 指定目标。"
}

if ($target.State -ne "device") {
    throw "设备 '$($target.Serial)' 当前状态为 $($target.State)；请授权 USB 调试或重新连接。"
}

$targetArgs = @("-s", $target.Serial)
function Get-AndroidProp([string]$Name) {
    (& $adb @targetArgs shell getprop $Name).Trim()
}

[pscustomobject]@{
    序列号 = $target.Serial
    厂商 = Get-AndroidProp "ro.product.manufacturer"
    型号 = Get-AndroidProp "ro.product.model"
    品牌 = Get-AndroidProp "ro.product.brand"
    设备代号 = Get-AndroidProp "ro.product.device"
    Android版本 = Get-AndroidProp "ro.build.version.release"
    SDK = Get-AndroidProp "ro.build.version.sdk"
    屏幕尺寸 = ((& $adb @targetArgs shell wm size) -join " ").Trim()
    屏幕密度 = ((& $adb @targetArgs shell wm density) -join " ").Trim()
} | Format-List

Write-Host "`nSIM 订阅信息：" -ForegroundColor Cyan
$isub = & $adb @targetArgs shell dumpsys isub
$isub | Select-String "Logical SIM slot|SubscriptionInfoInternal:" | ForEach-Object {
    $_.Line.Trim()
}
