export class BuilderKnowledgeGraph {

private nodes:any[] = [];
private relations:any[] = [];

addNode(node:any){

    this.nodes.push(node);

}

addRelation(relation:any){

    this.relations.push(relation);

}

getKnowledge(){

    return {
        nodes:this.nodes,
        relations:this.relations
    };

}

}
