Write-Host "================================="
Write-Host " HooshyarOS Build Assistant v1"
Write-Host "================================="

Write-Host ""
Write-Host "[1] Running Tests..."

npm test

if ($LASTEXITCODE -ne 0) {
    Write-Host "TEST FAILED"
    exit 1
}

Write-Host ""
Write-Host "[2] Git Status"

git status

Write-Host ""
Write-Host "[3] Recent Commits"

git log --oneline -5

Write-Host ""
Write-Host "================================="
Write-Host " Build Check Completed"
Write-Host "================================="
