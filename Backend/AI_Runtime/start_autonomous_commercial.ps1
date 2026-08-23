$ErrorActionPreference = "Stop"
$root = (git -C $PSScriptRoot rev-parse --show-toplevel).Trim()
Set-Location $root

Write-Host "[HooshyarOS] Canonical autonomous commercial continuation preflight"

$branch = (git branch --show-current).Trim()
if ($branch -ne "agent/release-final") {
    throw "Canonical continuation must run from agent/release-final. Current branch: $branch"
}

$statusLines = @(git status --porcelain)
if ($statusLines) {
    # Allow only untracked artifacts that are explicitly declared by the
    # canonical product roadmap. These are owned by the active autonomous knot
    # and must be verified/checkpointed by the daemon rather than discarded.
    $roadmapPath = Join-Path $root "Docs\Product\PRODUCT_CONSTRUCTION_ROADMAP.json"
    if (!(Test-Path $roadmapPath)) {
        throw "WORKTREE_NOT_CLEAN: canonical roadmap is unavailable to classify generated artifacts."
    }

    $roadmap = Get-Content $roadmapPath -Raw | ConvertFrom-Json
    $allowedGenerated = @(
        $roadmap.capabilities | ForEach-Object { $_.implementationPath }
        $roadmap.capabilities | ForEach-Object { $_.testPath }
        $roadmap.capabilities | ForEach-Object { $_.documentationPath }
    ) | Where-Object { $_ }

    $unexpected = @()
    foreach ($line in $statusLines) {
        $path = $line.Substring(3)
        $isUntracked = $line.StartsWith("?? ")
        if (-not ($isUntracked -and ($allowedGenerated -contains $path))) {
            $unexpected += $path
        }
    }

    if ($unexpected.Count -gt 0) {
        throw "WORKING_TREE_HAS_UNEXPECTED_CHANGES: $($unexpected -join '; ')"
    }

    Write-Host "Canonical generated artifacts detected; preserving them for autonomous knot verification/checkpoint."
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