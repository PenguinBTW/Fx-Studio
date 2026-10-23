@echo off
title Story Room - 1080p Full Adaptive Motion Blur Render
cd /d "C:\Users\brosf\Documents\A vio projects\VioPls\Agentic motion design toolset"
echo ==============================================================================
echo STARTING FULL 1080P ADAPTIVE MOTION BLUR RENDER (0.0s - 77.0s)
echo Target: out\story_room_1080p.mp4
echo ==============================================================================
"C:\Users\brosf\AppData\Local\Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64\bun.exe" run scripts/render.ts video --from 0 --to 77 --samples auto --shutter 0.5 --out out/story_room_1080pv2.mp4
echo ==============================================================================
echo RENDER COMPLETE! Output saved to out\story_room_1080p.mp4
echo ==============================================================================
pause
