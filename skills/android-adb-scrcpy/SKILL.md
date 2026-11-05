---
name: android-adb-scrcpy
description: Connect and control a USB-connected Android phone through ADB, scrcpy, and scrcpy-mcp; use for installation, Android model and dual-SIM discovery, USB authorization, projection, screenshots, UI actions, calls, SMS, alarms, or MCP setup. Exclude iOS, general Android app development, and emulator-only work unless explicitly requested.
---

# Android ADB / scrcpy Control

Set up and verify a real Android phone controlled from a desktop. Prefer ADB/scrcpy tools over blind coordinate automation, and discover device-specific values before acting.

中文副本：[SKILL.zh-CN.md](SKILL.zh-CN.md)。`SKILL.md` 仍是 Codex 自动识别的默认入口。

## Operating boundaries

- Never bypass a secure lock screen, password, PIN, pattern, or biometric prompt. Wake the device if useful, then ask the user to unlock it.
- Treat SMS, calls, messages, uploads, payments, deletion, installation, and security changes as external actions. Follow the user's explicit instruction, verify the exact target and operation, and stop if the recipient or payload is ambiguous.
- Do not infer a dual-SIM slot from appearance alone. Match the carrier name to the phone account/subscription ID and verify the result in the call log or UI.
- Redact contact numbers, message content, call logs, and other personal data unless the user needs them to verify an operation.
- Do not reuse coordinates or UI element indexes after the screen changes. Dump the current UI again before every coordinate action.

## 1. Identify the Android device

Before installation or automation, inspect the connected device. Run the bundled helper:

```powershell
pwsh -NoProfile -File scripts/android-info.ps1
```

For multiple devices, select one by serial:

```powershell
pwsh -NoProfile -File scripts/android-info.ps1 -Serial "<serial>"
```

The helper reports the serial, manufacturer, raw model property, brand, Android release, SDK, screen size/density, and SIM subscriptions. If PowerShell is unavailable, run the equivalent queries directly:

```powershell
adb devices -l
adb -s <serial> shell getprop ro.product.manufacturer
adb -s <serial> shell getprop ro.product.model
adb -s <serial> shell getprop ro.build.version.release
adb -s <serial> shell getprop ro.build.version.sdk
adb -s <serial> shell wm size
adb -s <serial> shell wm density
```

`ro.product.model` may be an OEM code rather than the marketing name. If a friendly name is needed, compare it with Settings → About phone, but never hard-code one device model into reusable instructions.

## 2. Install the Muse three-piece toolchain

“Muse” (绒毛) is the name of this compact setup recipe, not an installable software package. The three pieces are scrcpy/ADB, Node.js 24+, and scrcpy-mcp.

On Windows, scrcpy's WinGet package includes `adb.exe`:

```powershell
winget install --exact Genymobile.scrcpy
```

Install Node.js 24 or newer from the official LTS download at <https://nodejs.org/> (`scrcpy-mcp` currently requires Node 24+). Reopen the shell after installation so PATH changes take effect.

After connecting and authorizing the phone, run Muse's three-line acceptance sequence:

```powershell
adb devices
scrcpy --version
scrcpy
```

`adb devices` should show one device as `device`. `scrcpy --version` checks the client. `scrcpy` opens the projection window and keeps running until closed. If the phone is not connected yet, complete Section 3 first.

Also verify the MCP runtime:

```powershell
node --version
npx --version
```

If commands are missing, resolve their absolute paths with `Get-Command` or search the WinGet package folder. Do not install a second copy merely because the current shell has a stale PATH.

## 3. Enable USB debugging and authorize the computer

1. Enable Developer options on the phone.
2. Enable USB debugging.
3. Connect a known data-capable USB cable.
4. Unlock the phone and approve the RSA prompt.
5. Select “Always allow from this computer” when available.

Verify:

```powershell
adb devices -l
```

Expected state is `device`. Interpret other states this way:

- `unauthorized`: the user must approve the on-phone prompt.
- `offline`: reconnect USB or restart the ADB server.
- no device: check the cable, USB mode (prefer file transfer), port, and driver.

Recovery:

```powershell
adb kill-server
adb start-server
adb devices -l
```

Never attempt to automate USB authorization or a secure unlock.

## 4. Verify projection and screen state

Start a visible scrcpy window:

```powershell
scrcpy -s <serial>
```

Confirm the process has a window and is responding:

```powershell
Get-Process scrcpy | Select-Object Id, MainWindowTitle, Responding
```

Check whether the display is awake before UI automation:

```powershell
adb -s <serial> shell dumpsys power | Select-String "mWakefulness="
```

If it is `Dozing`, send a wake key:

```powershell
adb -s <serial> shell input keyevent KEYCODE_WAKEUP
```

Take a screenshot to inspect the lock state. If a password, PIN, pattern, or biometric prompt appears, stop and ask the user to unlock.

Capture a screenshot:

```powershell
adb -s <serial> shell screencap -p /sdcard/codex-screen.png
adb -s <serial> pull /sdcard/codex-screen.png .\codex-screen.png
```

## 5. Register scrcpy-mcp

For a quick standalone check, Muse's one-line launch is:

```powershell
npx -y scrcpy-mcp
```

It starts the local MCP stdio server and waits for an MCP client; it does not open the visible scrcpy window. Use `Ctrl+C` to stop it. For persistent Codex integration, register it as follows.

Find the install directory containing both `scrcpy.exe` and `scrcpy-server`, then register a stdio MCP server:

```powershell
$adb = (Get-Command adb).Source
$scrcpy = (Get-Command scrcpy).Source
$scrcpyDir = Split-Path $scrcpy
$server = Join-Path $scrcpyDir "scrcpy-server"

codex mcp add android `
  --env "ADB_PATH=$adb" `
  --env "SCRCPY_SERVER_PATH=$server" `
  -- npx -y scrcpy-mcp
```

Verify the saved configuration:

```powershell
codex mcp get android
codex mcp list
```

The MCP server runs locally over stdio. Review the package/source before enabling it: it exposes device control, shell, and file-transfer tools.

A Codex task created before registration may not receive the new tools dynamically. Restart Codex or open a new task if `android` tools are absent.

## 6. Smoke-test the MCP tools

Run this sequence before trying a sensitive app:

1. `device_list`
2. `start_session`
3. `screenshot`
4. `app_current`
5. `app_start` for a harmless app such as a calculator
6. `ui_find_element` for a known visible button
7. `tap` using the coordinates returned by that UI dump
8. Take another screenshot and verify the visible result
9. `stop_session` when the fast scrcpy session is no longer needed

If only one device is connected, tools normally auto-detect it. With multiple devices, pass the serial or set `ANDROID_SERIAL`.

## 7. Reliable UI interaction

Dump the current hierarchy before locating controls:

```powershell
adb -s <serial> shell uiautomator dump /sdcard/window.xml
adb -s <serial> pull /sdcard/window.xml .\window.xml
```

Parse the XML and select elements by visible text, content description, or resource ID. Derive tap coordinates from the current element bounds.

Keep this loop:

1. Dump and inspect the current screen.
2. Perform one action.
3. Dump or screenshot again.
4. Verify the expected state before continuing.

Resource IDs, coordinate positions, tab layouts, and app packages vary by OEM and firmware. Discover them; do not transplant assumptions from another phone.

## 8. Identify dual-SIM mappings

Use subscription information rather than visual slot numbers:

```powershell
adb -s <serial> shell dumpsys isub |
  Select-String "Logical SIM slot|SubscriptionInfoInternal"

adb -s <serial> shell dumpsys telecom |
  Select-String "PhoneAccount|defaultVoiceSubId"
```

Build a mapping from `subId` to `simSlotIndex`, display name, and carrier name. For example, the fields to compare are:

- `id=<subId>`
- `simSlotIndex=<slot>`
- `displayName=<label>`
- `carrierName=<carrier>`

Telecom phone-account IDs commonly equal the subscription ID on Android, but verify rather than assume.

For a call, the safest interaction is:

1. Open the dialer with the number prefilled.
2. Read the two labeled call buttons from a fresh UI dump.
3. Tap the button whose label matches the requested carrier.
4. Verify the call screen or call log records the expected subscription.

Prefill a call:

```powershell
adb -s <serial> shell "am start -a android.intent.action.DIAL -d tel:<number>"
```

Check the latest call record:

```powershell
adb -s <serial> shell "content query --uri content://call_log/calls --projection _id:number:name:type:date:duration:subscription_id:phone_account_address --sort 'date DESC' | head -n 5"
```

Do not report an unanswered call as connected. A very short duration or no active call means it was not answered.

## 9. SMS and contacts

Look up an exact contact name when the Contacts provider is readable. Preserve quoting around the SQL string; losing the inner quotes makes the name look like a column name.

PowerShell example:

```powershell
adb -s <serial> shell "content query --uri content://com.android.contacts/data --projection display_name:data1:mimetype --where `"display_name='<name>'`""
```

If access is denied or the result is ambiguous, use the Contacts UI and stop if multiple contacts share the name.

Prepare a draft without sending:

```powershell
adb -s <serial> shell "am start -a android.intent.action.SENDTO -d sms:<number> --es sms_body '<message>'"
```

Verify both the displayed recipient and exact text. Click the send control only when the user has authorized that message to that recipient. After sending, verify the message's status such as “Sending”, “Sent”, or “Delivered”; delivery depends on carrier and network support.

## 10. Alarms and timers

Discover the clock package rather than hard-coding one OEM's package:

```powershell
adb -s <serial> shell pm list packages |
  Select-String "alarm|clock|deskclock"
```

Open the relevant app, dump its UI, and identify each alarm card and switch from the current hierarchy. Enable or disable only the requested alarm and verify the switch state afterwards.

Confirm the system-level schedule:

```powershell
adb -s <serial> shell dumpsys alarm |
  Select-String "Alarm clock:|triggerTime="
```

The clock UI may show only the next pending alarm even when several future alarms are enabled. Verify each requested switch independently before reporting success.

## Troubleshooting

- `unauthorized`: ask the user to approve USB debugging; reconnecting may require a new approval.
- Device disappears after locking: ADB may remain visible but UI control cannot pass a secure lock.
- `scrcpy` not found: reopen the shell or use the executable's absolute path.
- MCP server starts but tools are missing in the current task: restart Codex or create a new task.
- Scrcpy server/version mismatch: point `SCRCPY_SERVER_PATH` directly to the `scrcpy-server` file from the same scrcpy installation.
- Multiple devices: pass `-s <serial>` to ADB/scrcpy and `serial` to MCP tools.
- UI dump fails while the display sleeps or is locked: wake and ask for manual unlock, then retry.
- App returns to home quickly: distinguish a missed/rejected call or failed launch from a successfully completed operation by checking UI state and logs.
