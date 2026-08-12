$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

Write-Host "=== HooshyarOS Autonomous Construction ===" -ForegroundColor Cyan
Write-Host "Syncing canonical main and reproducible dependencies..."

git fetch origin
git merge --ff-only origin/main
npm ci

Write-Host "Starting architecture-driven autonomous construction..." -ForegroundColor Cyan
npm run autonomous:build
