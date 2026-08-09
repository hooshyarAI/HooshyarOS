export class DecisionKnowledgeStore {

private knowledge:any[]=[];

add(item:any){
this.knowledge.push(item);
}

search(){
return this.knowledge;
}

}

