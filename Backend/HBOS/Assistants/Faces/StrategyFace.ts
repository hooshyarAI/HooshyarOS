export class StrategyFace {

name="StrategyFace";


initialize(){

console.log("StrategyFace initialized");

}


respond(input:string){

return {

face:this.name,

input,

timestamp:new Date().toISOString()

};

}

}

