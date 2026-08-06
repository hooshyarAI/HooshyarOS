param(
[string]$EngineName
)

if(!$EngineName){
    Write-Host "Please enter engine name"
    exit 1
}

$enginePath="Backend/HBOS/Engines/$EngineName.ts"
$testPath="Backend/HBOS/test/$EngineName.test.ts"

Write-Host ""
Write-Host "================================"
Write-Host " HooshyarOS Factory v1"
Write-Host "================================"

Write-Host ""
Write-Host "[1] Creating Engine..."

@"
export class $EngineName {

    initialize(){

        console.log("$EngineName Started");

        return {
            name:"$EngineName",
            status:"READY"
        };

    }

}
"@ | Out-File $enginePath -Encoding utf8


Write-Host "Engine created"


Write-Host ""
Write-Host "[2] Creating Test..."

@"
import { $EngineName } from "../Engines/$EngineName";


describe("$EngineName",()=>{

test("engine should initialize",()=>{

const engine=new $EngineName();

expect(
engine.initialize().status
)
.toBe("READY");

});

});
"@ | Out-File $testPath -Encoding utf8


Write-Host "Test created"


Write-Host ""
Write-Host "[3] Running Tests..."

npm test


if($LASTEXITCODE -ne 0){

Write-Host "TEST FAILED"
exit 1

}


Write-Host ""
Write-Host "================================"
Write-Host " Factory Completed Successfully "
Write-Host "================================"
