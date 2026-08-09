export class PersistentStorageAdapter {

private data:any[]=[];

save(item:any){
this.data.push(item);
return true;
}

load(){
return this.data;
}

}

