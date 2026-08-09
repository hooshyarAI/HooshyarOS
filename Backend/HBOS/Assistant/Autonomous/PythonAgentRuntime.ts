import { exec } from "child_process";


export class PythonAgentRuntime {


execute(code:string){

return new Promise((resolve)=>{


exec(
"python -c \""+code+"\"",
(error,stdout,stderr)=>{


resolve({

runtime:"python",
success:!error,
stdout,
stderr

});


});


});


}


}
