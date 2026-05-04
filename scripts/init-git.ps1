# Run from repo root:  powershell -ExecutionPolicy Bypass -File scripts/init-git.ps1
# Requires Git for Windows: https://git-scm.com/download/win

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git was not found on PATH." -ForegroundColor Red
    Write-Host "Install Git for Windows, restart the terminal, then run this script again."
    exit 1
}

if (Test-Path ".git") {
    Write-Host "Repository already exists (.git present). Skipping git init." -ForegroundColor Yellow
    git status
    exit 0
}

git init -b main
git add -A
git commit -m "Initial commit: SayCart Expo grocery app"

Write-Host ""
Write-Host "Local Git is ready. Next steps for GitHub:" -ForegroundColor Green
Write-Host "  1. Create a new repository on GitHub (private is fine)."
Write-Host "  2. git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git"
Write-Host "  3. git push -u origin main"
