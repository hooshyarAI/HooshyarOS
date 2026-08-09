export class AssistantFace {

name="AssistantFace";


initialize(){

console.log("AssistantFace initialized");

}


respond(input:string){

return {

face:this.name,

input,

timestamp:new Date().toISOString()

};

}

}

