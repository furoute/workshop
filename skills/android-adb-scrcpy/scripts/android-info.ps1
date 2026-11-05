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

    throw "adb.exe was not found. Install scrcpy with WinGet or add Android platform-tools to PATH."
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
    throw "No Android device detected. Check the USB cable, USB mode, and USB debugging."
}

if ($Serial) {
    $target = $devices | Where-Object Serial -eq $Serial | Select-Object -First 1
    if (-not $target) {
        throw "Device '$Serial' was not returned by adb devices."
    }
} elseif ($devices.Count -eq 1) {
    $target = $devices[0]
} else {
    throw "Multiple devices detected. Re-run with -Serial <serial>."
}

if ($target.State -ne "device") {
    throw "Device '$($target.Serial)' is $($target.State); approve USB debugging or reconnect it."
}

$targetArgs = @("-s", $target.Serial)
function Get-AndroidProp([string]$Name) {
    (& $adb @targetArgs shell getprop $Name).Trim()
}

[pscustomobject]@{
    Serial = $target.Serial
    Manufacturer = Get-AndroidProp "ro.product.manufacturer"
    Model = Get-AndroidProp "ro.product.model"
    Brand = Get-AndroidProp "ro.product.brand"
    Device = Get-AndroidProp "ro.product.device"
    AndroidVersion = Get-AndroidProp "ro.build.version.release"
    SDK = Get-AndroidProp "ro.build.version.sdk"
    ScreenSize = ((& $adb @targetArgs shell wm size) -join " ").Trim()
    ScreenDensity = ((& $adb @targetArgs shell wm density) -join " ").Trim()
} | Format-List

Write-Host "`nSubscriptions:" -ForegroundColor Cyan
$isub = & $adb @targetArgs shell dumpsys isub
$isub | Select-String "Logical SIM slot|SubscriptionInfoInternal:" | ForEach-Object {
    $_.Line.Trim()
}
