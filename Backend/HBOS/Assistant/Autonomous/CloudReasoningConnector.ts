export class CloudReasoningConnector {


ask(prompt:string){

return {

provider:"cloud",

prompt,

connected:true

};

}


}
