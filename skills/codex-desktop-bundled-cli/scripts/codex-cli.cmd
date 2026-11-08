@echo off
REM codex-cli.cmd -- run the CLI bundled with the Codex desktop app
REM
REM Why: every desktop update unpacks its CLI to
REM   %LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe
REM The hash changes per version, so the path must be discovered at run time.
REM This wrapper always picks the newest codex.exe - no manual upkeep.
REM
REM Usage: identical to codex.exe
REM   codex-cli.cmd --version
REM   codex-cli.cmd exec --dangerously-bypass-approvals-and-sandbox "task"
REM
REM Important: the CLI prints "Reading additional input from stdin..." and
REM waits forever when there is no terminal. stdin is therefore bound to NUL.
setlocal EnableDelayedExpansion

set "TARGET="
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "Get-ChildItem -Path \"$env:LOCALAPPDATA\OpenAI\Codex\bin\" -Recurse -Filter codex.exe -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName"`) do set "TARGET=%%F"

if not defined TARGET (
  for /f "delims=" %%N in ('where codex 2^>nul') do if not defined TARGET set "TARGET=%%N"
)

if not defined TARGET (
  echo [codex-cli] no bundled codex.exe and no global codex found >&2
  exit /b 127
)

"%TARGET%" %* < NUL
exit /b !ERRORLEVEL!
