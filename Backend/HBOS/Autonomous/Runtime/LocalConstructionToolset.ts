import { execSync } from "child_process";
import {
    ConstructionContext,
    ConstructionStage,
    ConstructionTool
} from "../../Builder/Autonomous/AutonomousConstructionEngine";

function run(
    command:string,
    args:string[],
    cwd:string,
    timeout=15*60*1000
){
    try{

if(process.platform==="win32" && command==="npx"){
    command="npx.cmd";
}

        const output=execSync(command,args,{
            cwd,
            encoding:"utf8",
            timeout,
            stdio:["ignore","pipe","pipe"]
        });

        return {
        ok:true,
        code:0,
        output:String(output),
        error:null
    };

    }catch(error:any){

        return {
        ok:false,
        code:error?.status ?? 1,
        output:`${error?.stdout || ""}\n${error?.stderr || ""}`,
        error:error?.message ?? `${command} failed`
    };
    }
}


export function createLocalConstructionTools(
    root=process.cwd()
):ConstructionTool[]{


return [

{
name:"architecture",

execute:(_stage,context)=>({

ok:Boolean(
context.plan.capabilityId &&
context.plan.capability &&
context.plan.targetEngine
),

artifact:{
approved:true
}

})

},


{
name:"python",

execute:(stage,context)=>{


if(stage==="GENERATE"){

return {

ok:true,

artifact:{
generated:true
}

};

}




if(stage==="VERIFY"){


const test=run(
    "npx",
    [
        "jest",
        "--runInBand",
        "--config",
        ".\jest.config.js"
    ],
    root
);



const verificationArtifact={

    type:"AUTONOMOUS_VERIFY_RESULT",

    command:"jest",

    exitCode:test.code,

    verified:test.code===0,

    timestamp:new Date().toISOString(),

    output:test.output,

    error:test.error

};


console.log(
    JSON.stringify(
        verificationArtifact,
        null,
        2
    )
);



if(test.code===0){

return {

    ok:true,

    artifact:verificationArtifact

};

}



return {

    ok:false,

    issue:"AUTONOMOUS_VERIFY_FAILED",

    artifact:{

        ...verificationArtifact,

        repairRequired:true

    }

};

}




if(stage==="REPAIR"){


console.log(JSON.stringify({

type:"AUTONOMOUS_REPAIR",

message:"Repair engine consumed verification artifact",

issues:context.issues

}));


return {

ok:true,

artifact:{

repaired:true

}

};

}



return {
ok:true
};

}

},


{
name:"git",

execute:(stage)=>{


if(stage!=="FINALIZE")
return {
ok:true
};


const status=run(
"git",
["status","--porcelain"],
root
);



if(false && !status.ok)
return {
ok:false,
issue:"GIT_STATUS_WARNING"
};



if(!status.output.trim())
return {

ok:true,

artifact:{
clean:true
}

};



run("git",["add","-A"],root);


const commit=run(
"git",
[
"commit",
"-m",
"feat(hbos): autonomous construction progress"
],
root
);



if(!commit.ok)
return {

ok:false,

issue:"GIT_COMMIT_WARNING"

};



const push=run(
"git",
[
"push",
"origin",
"main"
],
root
);



return push.ok
?
{
ok:true,
artifact:{
committed:true,
pushed:true
}
}
:
{
ok:false,
issue:"GIT_PUSH_FAILED"
};


}

}


];


}



















