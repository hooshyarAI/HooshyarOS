$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

Write-Host "=== HooshyarOS Autonomous Construction ===" -ForegroundColor Cyan
Write-Host "Syncing architecture-driven builder..."
git pull origin main


npm install
npm run autonomous:build
