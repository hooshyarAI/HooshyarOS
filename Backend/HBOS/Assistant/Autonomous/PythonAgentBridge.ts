export class PythonAgentBridge {


run(code:string){

return {

runtime:"python",

code,

connected:true

};

}


}
