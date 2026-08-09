export class MissionHistoryEngine {


private history:any[]=[];


record(item:any){

this.history.push({

time:new Date().toISOString(),

item

});

}


getHistory(){

return this.history;

}


}
