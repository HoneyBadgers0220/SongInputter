<# SongRate - Start server + Cloudflare Tunnel #>
$ErrorActionPreference = "Stop"
$CF = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  SongRate - Starting server + tunnel" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Start Flask server in background
Write-Host "[1/3] Starting Flask server..." -ForegroundColor Yellow
$server = Start-Process -FilePath "py" -ArgumentList "server.py" -WorkingDirectory $DIR -PassThru -WindowStyle Minimized
Start-Sleep -Seconds 3

if ($server.HasExited) {
    Write-Host "  ERROR: Server failed to start!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  OK - Server running on port 5000" -ForegroundColor Green

# 2. Start Cloudflare Tunnel
Write-Host "[2/3] Starting Cloudflare Tunnel..." -ForegroundColor Yellow

$logFile = Join-Path $DIR "tunnel.log"
if (Test-Path $logFile) { Remove-Item $logFile -Force }

$tunnel = Start-Process -FilePath $CF -ArgumentList "tunnel", "--url", "http://localhost:5000" -RedirectStandardError $logFile -PassThru -WindowStyle Hidden

# Wait for the URL to appear in the log (up to 30 seconds)
$publicUrl = ""
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $logFile) {
        $lines = Get-Content $logFile
        foreach ($line in $lines) {
            if ($line -match "(https://[a-z0-9\-]+\.trycloudflare\.com)") {
                $publicUrl = $Matches[1]
                break
            }
        }
        if ($publicUrl) { break }
    }
}

if (-not $publicUrl) {
    Write-Host "  WARNING: Could not detect tunnel URL." -ForegroundColor Red
    Write-Host "  Check tunnel.log for details." -ForegroundColor Red
}
else {
    Write-Host "  OK - Tunnel active" -ForegroundColor Green
}

# 3. Show URLs and copy to clipboard
Write-Host ""
Write-Host "[3/3] Ready!" -ForegroundColor Green
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Local:   http://localhost:5000" -ForegroundColor White
if ($publicUrl) {
    Write-Host "  Public:  $publicUrl" -ForegroundColor Green
    Set-Clipboard -Value $publicUrl
    Write-Host ""
    Write-Host "  URL copied to clipboard!" -ForegroundColor Magenta
    Write-Host "  Paste it on your phone to open SongRate." -ForegroundColor Magenta
}
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C or close this window to stop." -ForegroundColor DarkGray
Write-Host ""

# Keep alive
try {
    while (-not $server.HasExited) {
        Start-Sleep -Seconds 5
    }
}
finally {
    Write-Host ""
    Write-Host "Shutting down..." -ForegroundColor Yellow
    try { if (-not $server.HasExited) { Stop-Process -Id $server.Id -Force } } catch {}
    try { if (-not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force } } catch {}
    if (Test-Path $logFile) { Remove-Item $logFile -Force }
    Write-Host "Done." -ForegroundColor Green
}
