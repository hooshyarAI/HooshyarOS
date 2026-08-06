param(
[string]$EngineName
)

if(!$EngineName){
    Write-Host "Please enter engine name"
    exit 1
}

Write-Host "================================"
Write-Host "HooshyarOS Developer v1"
Write-Host "================================"

Write-Host "[1] Creating Engine..."

.\.tools\hfactory.ps1 $EngineName

Write-Host "[2] Git Status"

git status

Write-Host "================================"
Write-Host "Development Completed"
Write-Host "================================"
