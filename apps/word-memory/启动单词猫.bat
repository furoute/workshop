@echo off
chcp 65001 >nul 2>&1
title WordPet - Keep this window open

cd /d "%~dp0"

if not exist "tools\serve.mjs" (
  echo.
  echo   [X] Cannot find tools\serve.mjs
  echo       Current dir: %CD%
  echo.
  echo       Make sure this bat lives inside the wordpet folder.
  echo.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [X] Node.js not found. Please install it from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo   First run: installing dependencies, please wait...
  echo.
  call pnpm install
  if errorlevel 1 (
    echo.
    echo   [X] Install failed. Check your network and retry.
    echo.
    pause
    exit /b 1
  )
)

node "%~dp0tools\serve.mjs"

echo.
echo   Service stopped. Press any key to close.
pause >nul