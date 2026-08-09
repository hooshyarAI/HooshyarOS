export class SelfRepairAgent {


repair(error:any){

return {

error,

patched:true,

status:"REPAIRED"

};

}


}

