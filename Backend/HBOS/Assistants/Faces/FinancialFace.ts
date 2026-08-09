export class FinancialFace {

name="FinancialFace";


initialize(){

console.log("FinancialFace initialized");

}


respond(input:string){

return {

face:this.name,

input,

timestamp:new Date().toISOString()

};

}

}

