$Host.UI.RawUI.WindowTitle = "Story Room - Full Res 1080p Full Sampling Render"
Set-Location "c:\Users\brosf\Documents\A vio projects\VioPls\Agentic motion design toolset"

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " STARTING STORY ROOM FULL RES 1080P FULL SAMPLING RENDER" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "Window: 0.0s to 77.0s (4,620 frames)"
Write-Host "Resolution: 1920x1080 @ 60 FPS"
Write-Host "Sampling: --samples auto (Adaptive Sub-Frame Motion Blur up to 324 spp)"
Write-Host "Shutter: 0.5"
Write-Host "Audio: Master Aligned Track (17s pre-roll silence, +2.0s track seek)"
Write-Host "Destination: ../out/story_room/story_room_fullres.mp4"
Write-Host "=====================================================================" -ForegroundColor Cyan

$bunPath = "C:\Users\brosf\AppData\Local\Microsoft\WinGet\Packages\Oven-sh.Bun_Microsoft.Winget.Source_8wekyb3d8bbwe\bun-windows-x64\bun.exe"
$outMp4 = "..\out\story_room\story_room_fullres.mp4"
$audioFile = "app\public\audio\story_room_aligned.mp3"

if (Test-Path $bunPath) {
    & $bunPath scripts/render.ts video --from 0 --to 77 --fps 60 --crf 16 --samples auto --shutter 0.5 --out $outMp4
} else {
    bun scripts/render.ts video --from 0 --to 77 --fps 60 --crf 16 --samples auto --shutter 0.5 --out $outMp4
}

# Post-verification: ensure audio stream is present
if (Test-Path $outMp4) {
    $probe = & ffprobe -i $outMp4 -show_streams -select_streams a -loglevel error 2>&1
    if (-not $probe -and (Test-Path $audioFile)) {
        Write-Host "Muxing master audio stream into $outMp4..." -ForegroundColor Yellow
        $tempMux = "..\out\story_room\story_room_fullres_muxed.mp4"
        & ffmpeg -y -i $outMp4 -i $audioFile -c:v copy -c:a aac -b:a 320k -shortest $tempMux
        if (Test-Path $tempMux) {
            Move-Item -Path $tempMux -Destination $outMp4 -Force
            Write-Host "Audio successfully muxed!" -ForegroundColor Green
        }
    }
}

Write-Host "`n=====================================================================" -ForegroundColor Cyan
Write-Host " RENDER FINISHED!" -ForegroundColor Green
Write-Host " Video saved to: $outMp4" -ForegroundColor White
Write-Host "=====================================================================" -ForegroundColor Cyan
Read-Host "Press Enter to close window..."
