# Run the Play Store checklist in its own window.
# Usage (from any folder):
#   powershell -File C:\SayCart\tools\playstore-checklist\start.ps1

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

Write-Host ""
Write-Host "Starting Listahan Play Store Checklist..." -ForegroundColor Green
Write-Host ""

node server.mjs
