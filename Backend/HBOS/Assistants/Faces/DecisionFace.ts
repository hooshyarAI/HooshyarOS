export class DecisionFace {

name="DecisionFace";


initialize(){

console.log("DecisionFace initialized");

}


respond(input:string){

return {

face:this.name,

input,

timestamp:new Date().toISOString()

};

}

}

