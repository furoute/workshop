@echo off
chcp 65001 >nul 2>&1
title Word Atlas - 词光（这个窗口不要关）
cd /d C:\LLM\word-atlas
if not exist node_modules ( echo 首次运行，安装依赖... & call npm ci --no-audit --no-fund )
node tools\serve-wordatlas.mjs
pause
