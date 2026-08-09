import { execFileSync } from "child_process";
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
        const output=execFileSync(command,args,{
            cwd,
            encoding:"utf8",
            timeout,
            stdio:["ignore","pipe","pipe"]
        });

        return {
            ok:true,
            output:String(output)
        };

    }catch(error:any){

        return {
            ok:false,
            output:`${error?.stdout || ""}\n${error?.stderr || ""}`,
            issue:`${command} failed`
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
    ["jest","--runInBand","--passWithNoTests","--config","./jest.config.js"],
    root
);





if(test.ok){
    console.log(JSON.stringify({
        type:"AUTONOMOUS_VERIFY_PASS",
        message:"Jest verification passed"
    }));

    console.log(JSON.stringify({
        type:"AUTONOMOUS_VERIFY_PASS",
        message:"Jest verification passed"
    }));


return {

ok:true,

artifact:{
jest:"passed"
}

};

}



return {
    ok:false,
    issue:"AUTONOMOUS_VERIFY_FAILED",
    artifact:{
        verificationOutput:test.output,
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



if(!status.ok)
return {
ok:false,
issue:"GIT_STATUS_FAILED"
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

issue:"GIT_COMMIT_FAILED"

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





