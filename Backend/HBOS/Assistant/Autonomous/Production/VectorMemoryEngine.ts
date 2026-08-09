export class VectorMemoryEngine {

private vectors:any[]=[];

index(data:any){

this.vectors.push({
embedding:true,
data
});

}

search(){

return this.vectors;

}

}
