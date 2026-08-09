export class PersistentArchitectureMemory {

private store:any[]=[];

save(record:any){
this.store.push({
time:new Date().toISOString(),
record
});
return true;
}

load(){
return this.store;
}

clear(){
this.store=[];
}

}
