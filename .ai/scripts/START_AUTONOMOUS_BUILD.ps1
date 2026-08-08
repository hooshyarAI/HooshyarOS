$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))

Write-Host "=== HooshyarOS Autonomous Construction ===" -ForegroundColor Cyan
Write-Host "Syncing architecture-driven builder..."
git pull origin main

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    Write-Error "Codex CLI is not installed or not on PATH. Install @openai/codex first."
    exit 1
}

npm install
npm run autonomous:build
