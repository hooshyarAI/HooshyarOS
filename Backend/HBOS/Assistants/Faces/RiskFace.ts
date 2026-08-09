export class RiskFace {

name="RiskFace";


initialize(){

console.log("RiskFace initialized");

}


respond(input:string){

return {

face:this.name,

input,

timestamp:new Date().toISOString()

};

}

}

