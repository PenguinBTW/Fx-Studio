@echo off
setlocal
title f(x) Studio - Video Renderer
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0render.ps1" %*

if %ERRORLEVEL% neq 0 (
  echo.
  echo [render] Process ended with code %ERRORLEVEL%.
)

echo.
pause
