# ==============================================================================
# f(x) Studio — Interactive Video Render Wizard (PowerShell)
# ==============================================================================
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$OutDir = Join-Path $ScriptDir "out"
if (!(Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

# If arguments passed directly, pass through
if ($args.Count -gt 0) {
    & bun scripts/render.ts video @args
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║             f(x) Studio — Video Render Wizard              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# 1. Discover available projects
$Projects = Get-ChildItem -Path "app\src\scenes" -Directory | Where-Object {
    Test-Path (Join-Path $_.FullName "project.json")
} | Select-Object -ExpandProperty Name | Sort-Object

if ($Projects.Count -eq 0) {
    Write-Host "[Error] No projects found in app/src/scenes with project.json" -ForegroundColor Red
    exit 1
}

# Active project
$DefaultProject = "bird_odyssey"
if (Test-Path "app\src\scenes\active.json") {
    try {
        $ActiveJson = Get-Content "app\src\scenes\active.json" -Raw | ConvertFrom-Json
        if ($ActiveJson.project -and ($Projects -contains $ActiveJson.project)) {
            $DefaultProject = $ActiveJson.project
        }
    } catch {}
}

Write-Host "Available Projects:" -ForegroundColor White
for ($i = 0; $i -lt $Projects.Count; $i++) {
    $idx = $i + 1
    $p = $Projects[$i]
    if ($p -eq $DefaultProject) {
        Write-Host ([string]::Format("  {0,2}) {1,-24} (active/default)", $idx, $p)) -ForegroundColor Green
    } else {
        Write-Host ([string]::Format("  {0,2}) {1,-24}", $idx, $p)) -ForegroundColor Gray
    }
}
Write-Host ""

$Chosen = Read-Host "Select project [1-$($Projects.Count) or name] [default: $DefaultProject]"
if ([string]::IsNullOrWhiteSpace($Chosen)) { $Chosen = $DefaultProject }

if ($Chosen -match '^\d+$' -and [int]$Chosen -ge 1 -and [int]$Chosen -le $Projects.Count) {
    $Project = $Projects[[int]$Chosen - 1]
} else {
    $Project = $Chosen
}

$ProjectJsonPath = "app\src\scenes\$Project\project.json"
if (!(Test-Path $ProjectJsonPath)) {
    Write-Host "[Error] Project '$Project' not found at $ProjectJsonPath" -ForegroundColor Red
    exit 1
}

Write-Host "Selected: $Project`n" -ForegroundColor Cyan

# 2. Audio detection for selected project
$ProjectDir = "app\src\scenes\$Project"
$DetectedMix = $null
$DetectedAudio = $null

if (Test-Path $ProjectJsonPath) {
    try {
        $PJson = Get-Content $ProjectJsonPath -Raw | ConvertFrom-Json
        if ($PJson.mix) {
            $cand = Join-Path $ProjectDir $PJson.mix
            if (Test-Path $cand) { $DetectedMix = $cand }
        }
        if ($PJson.audio) {
            $audioPath = if ($PJson.audio -is [string]) { $PJson.audio } elseif ($PJson.audio.soundtrack) { $PJson.audio.soundtrack } else { $null }
            if ($audioPath) {
                $cand = Join-Path $ProjectDir $audioPath
                if (Test-Path $cand) { $DetectedAudio = $cand }
            }
        }
    } catch {}
}

if (!$DetectedMix) {
    foreach ($cand in @("$ProjectDir\audio\mix.ts", "$ProjectDir\audio\mix.json", "$ProjectDir\mix.json")) {
        if (Test-Path $cand) { $DetectedMix = $cand; break }
    }
}

if (!$DetectedAudio) {
    $candAudio = @(
        "$ProjectDir\master\fx_promo_mix.mp3",
        "$ProjectDir\audio\soundtrack.wav",
        "$ProjectDir\audio\soundtrack_22s.wav",
        "$ProjectDir\audio\mix.wav",
        "$ProjectDir\audio\audio.wav",
        "$ProjectDir\audio\audio.mp3"
    )
    foreach ($cand in $candAudio) {
        if (Test-Path $cand) { $DetectedAudio = $cand; break }
    }
    if (!$DetectedAudio) {
        foreach ($d in @("$ProjectDir\master", "$ProjectDir\audio")) {
            if (Test-Path $d) {
                $anyTrack = Get-ChildItem -Path $d -Include "*.wav","*.mp3" -File -Depth 1 | Select-Object -First 1
                if ($anyTrack) { $DetectedAudio = $anyTrack.FullName; break }
            }
        }
    }
}

# 3. Project duration
$Duration = 10
try {
    $PJson = Get-Content $ProjectJsonPath -Raw | ConvertFrom-Json
    $Ends = @($PJson.entries | ForEach-Object { [double]$_.end })
    if ($Ends.Count -gt 0) {
        $MaxEnd = ($Ends | Measure-Object -Maximum).Maximum
        if ($MaxEnd -gt 0) { $Duration = $MaxEnd }
    }
} catch {}

# 4. Time range
$InputFrom = Read-Host "Start time (seconds) [default: 0]"
$From = if ([string]::IsNullOrWhiteSpace($InputFrom)) { 0 } else { [double]$InputFrom }

$InputTo = Read-Host "End time (seconds) [default: $Duration (full)]"
$To = if ([string]::IsNullOrWhiteSpace($InputTo)) { $Duration } else { [double]$InputTo }

# 5. Audio configuration
$AudioArgs = @()
$AudioSummary = ""

if ($DetectedMix -or $DetectedAudio) {
    Write-Host "`nAudio detected for '$Project':" -ForegroundColor Cyan
    $audioOptions = [System.Collections.Generic.List[hashtable]]::new()

    # If project has a master audio track (e.g. fx_promo_mix.mp3), prioritize it as Recommended
    if ($DetectedAudio) {
        $audioRel = ($DetectedAudio.Replace($ScriptDir, "").TrimStart('\/')).Replace('\', '/')
        $audioOptions.Add(@{
            Label = "Project Master Audio Track ($audioRel) [Recommended: remixed master]"
            Args = @("--audio", $audioRel)
            Summary = "Master Track ($audioRel)"
        })
    }

    if ($DetectedMix) {
        $mixRel = ($DetectedMix.Replace($ScriptDir, "").TrimStart('\/')).Replace('\', '/')
        $label = if ($DetectedAudio) { "Project Multi-track Mixdown ($mixRel) (re-mix stems)" } else { "Project Multi-track Mixdown ($mixRel) [Recommended: stems + SFX + ducking]" }
        $audioOptions.Add(@{
            Label = $label
            Args = @("--mix", $mixRel)
            Summary = "Project Mixdown ($mixRel)"
        })
    }

    $audioOptions.Add(@{
        Label = "Mute / No Audio (--noaudio)"
        Args = @("--noaudio")
        Summary = "Muted / Silent (--noaudio)"
    })

    $audioOptions.Add(@{
        Label = "Global fallback track (app/public/audio/audio.mp3)"
        Args = @("--audio", "app/public/audio/audio.mp3")
        Summary = "Global track (app/public/audio/audio.mp3)"
    })

    $audioOptions.Add(@{
        Label = "Custom audio file path..."
        Custom = $true
    })

    for ($i = 0; $i -lt $audioOptions.Count; $i++) {
        $col = if ($i -eq 0) { "Green" } else { "Gray" }
        Write-Host "  $($i + 1)) $($audioOptions[$i].Label)" -ForegroundColor $col
    }

    $choice = Read-Host "`nSelect audio [1-$($audioOptions.Count)] [default: 1]"
    $choiceIdx = if ([string]::IsNullOrWhiteSpace($choice)) { 0 } else { [int]$choice - 1 }
    if ($choiceIdx -lt 0 -or $choiceIdx -ge $audioOptions.Count) { $choiceIdx = 0 }

    $selectedOpt = $audioOptions[$choiceIdx]
    if ($selectedOpt.Custom) {
        $customPath = Read-Host "Enter audio file path"
        if (![string]::IsNullOrWhiteSpace($customPath) -and (Test-Path $customPath)) {
            $customNorm = $customPath.Replace('\', '/')
            $AudioArgs = @("--audio", $customNorm)
            $AudioSummary = "Custom ($customNorm)"
        } else {
            Write-Host "Path not found or empty. Defaulting to mute." -ForegroundColor Yellow
            $AudioArgs = @("--noaudio")
            $AudioSummary = "Muted / Silent (--noaudio)"
        }
    } else {
        $AudioArgs = $selectedOpt.Args
        $AudioSummary = $selectedOpt.Summary
    }
} else {
    Write-Host "`nAudio: No project-specific audio found for '$Project'." -ForegroundColor Yellow
    Write-Host "  1) Mute / No Audio (Recommended: silent render) (--noaudio)" -ForegroundColor Green
    Write-Host "  2) Use global sample track (app/public/audio/audio.mp3)" -ForegroundColor Gray
    Write-Host "  3) Custom audio file path..." -ForegroundColor Gray

    $choice = Read-Host "`nSelect audio [1-3] [default: 1]"
    if ($choice -eq "2") {
        $AudioArgs = @("--audio", "app/public/audio/audio.mp3")
        $AudioSummary = "Global track (app/public/audio/audio.mp3)"
    } elseif ($choice -eq "3") {
        $customPath = Read-Host "Enter audio file path"
        if (![string]::IsNullOrWhiteSpace($customPath) -and (Test-Path $customPath)) {
            $customNorm = $customPath.Replace('\', '/')
            $AudioArgs = @("--audio", $customNorm)
            $AudioSummary = "Custom ($customNorm)"
        } else {
            Write-Host "Path not found or empty. Defaulting to mute." -ForegroundColor Yellow
            $AudioArgs = @("--noaudio")
            $AudioSummary = "Muted / Silent (--noaudio)"
        }
    } else {
        $AudioArgs = @("--noaudio")
        $AudioSummary = "Muted / Silent (--noaudio)"
    }
}

# 6. Sampling
Write-Host "`nSampling (sub-frames per frame for motion blur & temporal AA):" -ForegroundColor White
Write-Host "  8    - High quality (Recommended: smooth motion blur, fast)" -ForegroundColor Green
Write-Host "  1    - Preview (sharp, no motion blur, fastest)" -ForegroundColor Gray
Write-Host "  16   - Cinematic (ultra-smooth motion blur)" -ForegroundColor Gray
Write-Host "  auto - Adaptive tolerance (can be slow on complex 3D scenes)" -ForegroundColor Yellow
$InputSamples = Read-Host "Samples [8 / 1 / 16 / auto, or number] [default: 8]"
$Samples = if ([string]::IsNullOrWhiteSpace($InputSamples)) { "8" } else { $InputSamples }

# 7. FPS
$InputFps = Read-Host "`nFrame rate (FPS) [24 / 30 / 60] [default: 60]"
$Fps = if ([string]::IsNullOrWhiteSpace($InputFps)) { 60 } else { [int]$InputFps }

# 8. GPU
$InputGpu = Read-Host "`nEnable GPU hardware encoding (AMD AMF / NVENC)? [Y/n] [default: Y]"
$UseGpu = if ([string]::IsNullOrWhiteSpace($InputGpu) -or $InputGpu -match '^[Yy]') { $true } else { $false }

# 9. Orientation & Resolution
$IsVerticalProject = $false
try {
    $PJsonObj = Get-Content $ProjectJsonPath -Raw | ConvertFrom-Json
    if ($PJsonObj.size -and $PJsonObj.size.Count -ge 2 -and [int]$PJsonObj.size[1] -gt [int]$PJsonObj.size[0]) {
        $IsVerticalProject = $true
    }
} catch {}

Write-Host "`nOrientation:" -ForegroundColor White
if ($IsVerticalProject) {
    Write-Host "  Detected: Vertical 9:16 (Shorts / Reels / TikTok: 1080x1920)" -ForegroundColor Cyan
    Write-Host "  1) Vertical 9:16 (Shorts / Reels / TikTok) [Default]" -ForegroundColor Green
    Write-Host "  2) Horizontal 16:9 (Landscape)" -ForegroundColor Gray
    $InputOrient = Read-Host "`nSelect orientation [1 = Vertical, 2 = Horizontal] [default: 1]"
    $IsVertical = if ($InputOrient -eq "2") { $false } else { $true }
} else {
    Write-Host "  Detected: Horizontal 16:9 (Landscape: 1920x1080)" -ForegroundColor Cyan
    Write-Host "  1) Horizontal 16:9 (Landscape) [Default]" -ForegroundColor Green
    Write-Host "  2) Vertical 9:16 (Shorts / Reels / TikTok)" -ForegroundColor Gray
    $InputOrient = Read-Host "`nSelect orientation [1 = Horizontal, 2 = Vertical] [default: 1]"
    $IsVertical = if ($InputOrient -eq "2") { $true } else { $false }
}

Write-Host "`nResolution:" -ForegroundColor White
if ($IsVertical) {
    Write-Host "  1) 720p  - Fast Preview / Draft (720x1280) [Fastest]" -ForegroundColor Gray
    Write-Host "  2) 1080p - Standard Full HD (1080x1920) [Recommended / Default]" -ForegroundColor Green
    Write-Host "  3) 4K    - Ultra HD (2160x3840) [High Quality]" -ForegroundColor Gray
} else {
    Write-Host "  1) 720p  - Fast Preview / Draft (1280x720) [Fastest]" -ForegroundColor Gray
    Write-Host "  2) 1080p - Standard Full HD (1920x1080) [Recommended / Default]" -ForegroundColor Green
    Write-Host "  3) 4K    - Ultra HD (3840x2160) [High Quality]" -ForegroundColor Gray
}

$InputRes = Read-Host "`nSelect resolution [1 = 720p, 2 = 1080p, 3 = 4K] [default: 2]"
$ResChoice = if ([string]::IsNullOrWhiteSpace($InputRes)) { "2" } else { $InputRes.Trim() }

$ResArgs = @()
$ResLabel = ""
$ResDims = ""

if ($ResChoice -eq "1" -or $ResChoice -like "*720*") {
    $ResArgs = @("--720p")
    if ($IsVertical) { $ResArgs += "--vertical" } else { $ResArgs += "--horizontal" }
    $ResLabel = "720p"
    $ResDims = if ($IsVertical) { "720x1280 (vertical 9:16)" } else { "1280x720 (16:9)" }
} elseif ($ResChoice -eq "3" -or $ResChoice -like "*4k*" -or $ResChoice -like "*4K*") {
    $ResArgs = @("--4k")
    if ($IsVertical) { $ResArgs += "--vertical" } else { $ResArgs += "--horizontal" }
    $ResLabel = "4K Ultra HD"
    $ResDims = if ($IsVertical) { "2160x3840 (vertical 9:16)" } else { "3840x2160 (16:9)" }
} else {
    $ResArgs = @("--1080p")
    if ($IsVertical) { $ResArgs += "--vertical" } else { $ResArgs += "--horizontal" }
    $ResLabel = "1080p Full HD"
    $ResDims = if ($IsVertical) { "1080x1920 (vertical 9:16)" } else { "1920x1080 (16:9)" }
}

# 10. Output Filename
$DefaultOut = "${Project}.mp4"
if ($To -ne $Duration -or $From -ne 0) {
    $DefaultOut = "${Project}_${From}s_${To}s.mp4"
}

Write-Host "`nOutput file destination: $OutDir\" -ForegroundColor White
$InputOut = Read-Host "Output filename [default: $DefaultOut]"
$OutFile = if ([string]::IsNullOrWhiteSpace($InputOut)) { $DefaultOut } else { $InputOut }
if ($OutFile -notmatch '\.[a-zA-Z0-9]+$') {
    $OutFile = "$OutFile.mp4"
}

$RelOut = "out/$OutFile"
$AbsOut = Join-Path $OutDir $OutFile

# 11. Summary & Confirmation
$TotalSec = [math]::Round($To - $From, 2)
$TotalFrames = [math]::Round(($To - $From) * $Fps)

Write-Host "`n────────────────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "Render Configuration Summary:" -ForegroundColor White
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Cyan
Write-Host "  • Project:      $Project" -ForegroundColor Green
Write-Host "  • Orientation:  $(if ($IsVertical) { 'Vertical 9:16 (Shorts / Reels / TikTok)' } else { 'Horizontal 16:9 (Landscape)' })" -ForegroundColor Cyan
Write-Host "  • Resolution:   $ResLabel ($ResDims)" -ForegroundColor Green
Write-Host "  • Time Window:  ${From}s → ${To}s (${TotalSec}s duration / ${TotalFrames} frames)" -ForegroundColor Yellow
Write-Host "  • Sampling:     $Samples" -ForegroundColor Green
Write-Host "  • Frame Rate:   $Fps fps" -ForegroundColor Green
Write-Host "  • GPU Encode:   $(if ($UseGpu) { 'Enabled (--gpu)' } else { 'Disabled' })" -ForegroundColor Green
Write-Host "  • Audio:        $AudioSummary" -ForegroundColor $(if ($AudioSummary -like "*Muted*") { "DarkGray" } else { "Green" })
Write-Host "  • Output Path:  $RelOut" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Cyan

$CmdArgs = @("scripts/render.ts", "video", "--project", $Project, "--from", $From, "--to", $To, "--fps", $Fps, "--samples", $Samples, "--out", $RelOut)
$CmdArgs += $ResArgs
if ($UseGpu) { $CmdArgs += "--gpu" }
if ($AudioArgs.Count -gt 0) { $CmdArgs += $AudioArgs }

Write-Host "Executing command:" -ForegroundColor White
Write-Host "  bun $($CmdArgs -join ' ')`n" -ForegroundColor DarkGray

$Confirm = Read-Host "Start render now? [Y/n] [default: Y]"
if (![string]::IsNullOrWhiteSpace($Confirm) -and $Confirm -notmatch '^[Yy]') {
    Write-Host "`nRender aborted by user." -ForegroundColor Yellow
    exit 0
}

Write-Host "`n[render] Starting render pipeline...`n" -ForegroundColor Green
$Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

& bun @CmdArgs

$Stopwatch.Stop()
$Elapsed = [math]::Round($Stopwatch.Elapsed.TotalSeconds, 1)

Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
if (Test-Path $AbsOut) {
    $Item = Get-Item $AbsOut
    $SizeMb = [math]::Round($Item.Length / 1MB, 2)
    Write-Host "✔ Render Complete in ${Elapsed}s!" -ForegroundColor Green
    Write-Host "  Output file: $AbsOut (${SizeMb} MB)" -ForegroundColor White
} else {
    Write-Host "✔ Render process finished in ${Elapsed}s!" -ForegroundColor Green
    Write-Host "  Output path: $RelOut" -ForegroundColor White
}
Write-Host "════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
