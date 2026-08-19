$ErrorActionPreference = "Stop"
$root = (git -C $PSScriptRoot rev-parse --show-toplevel).Trim()
Set-Location $root

Write-Host "[HooshyarOS] Canonical autonomous commercial continuation preflight"

$branch = (git branch --show-current).Trim()
if ($branch -ne "agent/release-final") {
    throw "Canonical continuation must run from agent/release-final. Current branch: $branch"
}

$status = git status --porcelain
if ($status) {
    throw "Working tree is not clean. Preserve local changes; do not let autonomous construction overwrite them."
}

git fetch origin agent/release-final
$local = (git rev-parse HEAD).Trim()
$remote = (git rev-parse origin/agent/release-final).Trim()
if ($local -ne $remote) {
    throw "Local agent/release-final is not synchronized with origin. Run the repository synchronization procedure first."
}

Write-Host "[1/2] Running full deterministic preflight test suite..."
& npm test -- --runInBand
if ($LASTEXITCODE -ne 0) {
    throw "PRECHECK_FAILED: autonomous commercial continuation is blocked because the full test suite failed."
}

Write-Host "[2/2] Starting the canonical unattended commercial supervisor..."
Write-Host "The supervisor does not certify completion itself; the HBOS daemon must produce independent runtime/commercial evidence."
& python Backend\AI_Runtime\hooshyar_build.py commercial
$code = $LASTEXITCODE

if ($code -ne 0) {
    throw "AUTONOMOUS_COMMERCIAL_BLOCKED: supervisor exited with code $code. Inspect preserved evidence/checkpoints before retrying."
}

Write-Host "[HooshyarOS] Autonomous commercial supervisor ended with a verified completion signal."
