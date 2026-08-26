$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo

Write-Host '=== BUILD WINDOWS PAYLOAD ==='
python Backend/AI_Runtime/release_product_builder.py

$InstallerDir = Join-Path $Repo 'dist/productization/windows/installer'
New-Item -ItemType Directory -Force -Path $InstallerDir | Out-Null

$Iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $Iscc) {
    $Candidates = @(
        "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
    )
    $Path = $Candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $Path) { throw 'Inno Setup 6 ISCC.exe was not found.' }
    $Iscc = @{ Source = $Path }
}

Write-Host '=== COMPILE WINDOWS INSTALLER ==='
& $Iscc.Source "$Repo\installer\HooshyarOS.iss"

$Installer = Join-Path $InstallerDir 'HooshyarOS-Setup-1.0.0.exe'
if (-not (Test-Path $Installer)) { throw "Installer was not produced: $Installer" }

Write-Host "WINDOWS_INSTALLER=$Installer"
