export class GitAutonomousManager {


commit(message:string){

return {

message,

committed:true,

time:new Date().toISOString()

};

}


rollback(){

return {

rollback:true

};

}


}
