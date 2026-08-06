param(
[string]$Message="auto update"
)

Write-Host "================================="
Write-Host " HooshyarOS Release Assistant v1"
Write-Host "================================="


Write-Host ""
Write-Host "[1] Running Tests..."

npm test

if($LASTEXITCODE -ne 0){

Write-Host "TEST FAILED - Commit cancelled"
exit 1

}


Write-Host ""
Write-Host "[2] Git Add"

git add .


Write-Host ""
Write-Host "[3] Commit"

git commit -m $Message


Write-Host ""
Write-Host "[4] Push"

git push


Write-Host ""
Write-Host "================================="
Write-Host " Release Completed Successfully"
Write-Host "================================="
