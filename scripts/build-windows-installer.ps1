$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Repo = Split-Path -Parent $PSScriptRoot
Set-Location $Repo

Write-Host '=== BUILD WINDOWS PAYLOAD ==='
python Backend/AI_Runtime/release_product_builder.py
if ($LASTEXITCODE -ne 0) { throw "release_product_builder.py failed with exit code $LASTEXITCODE" }

$InstallerDir = Join-Path $Repo 'dist/productization/windows/installer'
New-Item -ItemType Directory -Force -Path $InstallerDir | Out-Null

function Find-InnoSetupCompiler {
    $Command = Get-Command ISCC.exe -ErrorAction SilentlyContinue
    if ($Command) { return $Command.Source }

    $Candidates = @(
        "${env:ProgramFiles(x86)}\Inno Setup 7\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 7\ISCC.exe",
        "${env:LOCALAPPDATA}\Programs\Inno Setup 7\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
        "${env:LOCALAPPDATA}\Programs\Inno Setup 6\ISCC.exe"
    )

    return $Candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}

$IsccPath = Find-InnoSetupCompiler

if (-not $IsccPath) {
    # Prefer an existing compiler; provision the official one through the
    # standard Windows package mechanism only when none is installed.
    $Winget = (Get-Command winget.exe -ErrorAction SilentlyContinue).Source
    if ($Winget) {
        Write-Host '=== PROVISION INNO SETUP (winget JRSoftware.InnoSetup.7) ==='
        & $Winget install --id JRSoftware.InnoSetup.7 --exact --source winget `
            --accept-source-agreements --accept-package-agreements --silent
        $IsccPath = Find-InnoSetupCompiler
    }
}

if (-not $IsccPath) {
    throw 'Inno Setup compiler (ISCC.exe) was not found and could not be provisioned. Install Inno Setup 6 or 7 and rerun the installer build.'
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
