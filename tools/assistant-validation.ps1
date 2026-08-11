[CmdletBinding()]
param(
    [switch]$Sync,
    [switch]$Full
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

function Invoke-Checked {
    param(
        [Parameter(Mandatory=$true)][string]$Label,
        [Parameter(Mandatory=$true)][scriptblock]$Command
    )

    Write-Host "`n===== $Label =====" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label FAILED (exit code $LASTEXITCODE)"
    }
}

if ($Sync) {
    Invoke-Checked "GIT SYNC" { git fetch origin }
    Invoke-Checked "GIT MAIN" { git checkout main }
    Invoke-Checked "GIT RESET" { git reset --hard origin/main }
    Invoke-Checked "GIT CLEAN" { git clean -fd }
}

Invoke-Checked "GIT BASELINE" { git rev-parse --short HEAD }
Invoke-Checked "GIT STATUS" { git status --short --branch }

$focusedTests = @(
    "Backend/HBOS/test/AutonomousProjectMission.test.ts",
    "Backend/HBOS/test/AutonomousProjectMission.platform-order.test.ts",
    "Backend/HBOS/test/AutonomousPlatformWeaving.test.ts",
    "Backend/HBOS/test/AutonomousCompletionGate.test.ts",
    "Backend/HBOS/test/AssistantCompletionGate.test.ts"
)

Invoke-Checked "ASSISTANT FOCUSED TESTS" {
    npx jest --runInBand @focusedTests
}

if ($Full) {
    Invoke-Checked "FULL JEST" { npx jest --runInBand }
}

Write-Host "`n===== ASSISTANT VALIDATION COMPLETE =====" -ForegroundColor Green
Write-Host "HEAD: $(git rev-parse --short HEAD)"
Write-Host "STATUS:"
git status --short --branch
