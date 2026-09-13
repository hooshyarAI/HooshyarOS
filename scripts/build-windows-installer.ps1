$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo

Write-Host '=== BUILD WINDOWS PAYLOAD ==='
python Backend/AI_Runtime/release_product_builder.py

$InstallerDir = Join-Path $Repo 'dist/productization/windows/installer'
New-Item -ItemType Directory -Force -Path $InstallerDir | Out-Null

$IsccPath = $null
$Command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if ($Command) {
    $IsccPath = $Command.Source
}

if (-not $IsccPath) {
    $Candidates = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
        "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe"
    )

    $IsccPath = $Candidates |
        Where-Object { $_ -and (Test-Path $_) } |
        Select-Object -First 1
}

if (-not $IsccPath) {
    throw 'Inno Setup 6 ISCC.exe was not found. Install Inno Setup 6 and rerun the installer build.'
}

Write-Host "Using Inno Setup compiler: $IsccPath"
Write-Host '=== COMPILE WINDOWS INSTALLER ==='
& $IsccPath "$Repo\installer\HooshyarOS.iss"

if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup compiler failed with exit code $LASTEXITCODE."
}

$Installer = Join-Path $InstallerDir 'HooshyarOS-Setup-1.0.0.exe'
if (-not (Test-Path $Installer)) {
    throw "Installer was not produced: $Installer"
}

Write-Host "WINDOWS_INSTALLER=$Installer"
