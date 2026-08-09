export interface FailureReport{
type:string;
file:string;
message:string;
}


export class AutonomousFailureAnalyzer{


analyze(output:string):FailureReport{


const fileMatch =
output.match(/Backend\/HBOS\/[^\s]+\.ts/);


return {

type:
output.includes("FAIL")
?
"TEST_FAILURE"
:
"UNKNOWN",

file:
fileMatch
?
fileMatch[0]
:
"unknown",

message:
"Failure analyzed by autonomous analyzer"

};

}


}
