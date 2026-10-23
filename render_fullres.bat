@echo off
title Story Room - Full Res 1080p Full Sampling Render
cd /d "%~dp0"
set BUN="C:\Users\brosf\AppData\Local\Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64\bun.exe"
if not exist %BUN% set BUN=bun

echo =====================================================================
echo  STARTING STORY ROOM FULL RES 1080P FULL SAMPLING RENDER
echo =====================================================================
echo Window: 0.0s to 77.0s (4,620 frames)
echo Resolution: 1920x1080 @ 60 FPS
echo Sampling: --samples auto (Adaptive Sub-Frame Motion Blur up to 324 spp)
echo Shutter: 0.5
echo Audio: Master Aligned Track (17s pre-roll silence, +2.0s track seek)
echo Destination: ../out/story_room/story_room_fullres.mp4
echo =====================================================================
echo Executing: %BUN% scripts/render.ts video --from 0 --to 77 --fps 60 --crf 16 --samples auto --shutter 0.5 --out ../out/story_room/story_room_fullres.mp4
echo =====================================================================
%BUN% scripts/render.ts video --from 0 --to 77 --fps 60 --crf 16 --samples auto --shutter 0.5 --out ../out/story_room/story_room_fullres.mp4
echo.
echo =====================================================================
echo  RENDER FINISHED!
echo =====================================================================
pause
