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

$name = git config user.name 2>$null
$email = git config user.email 2>$null
if (-not $name -or -not $email) {
    Write-Host "Git needs your name and email before it can create commits (one-time on this PC)." -ForegroundColor Yellow
    Write-Host ""
    Write-Host '  git config --global user.name "Your Name"'
    Write-Host '  git config --global user.email "you@example.com"'
    Write-Host ""
    Write-Host "Use the email you use on GitHub (or GitHub's private noreply address in account settings)."
    Write-Host "Then run this script again, or run: git commit -m `"your message`""
    exit 1
}

if (-not (Test-Path ".git")) {
    git init -b main
}

git add -A
git commit -m "Initial commit: SayCart Expo grocery app"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Commit did not run (e.g. nothing new to commit, or resolve any error above)." -ForegroundColor Yellow
    git status
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Local Git is ready. Next steps for GitHub:" -ForegroundColor Green
Write-Host "  1. Create a new repository on GitHub (private is fine)."
Write-Host "  2. git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git"
Write-Host "  3. git push -u origin main"
