export class AgentMemoryBridge {

constructor(private memory:any){}

remember(data:any){

    this.memory.remember(data);

}

recall(){

    return this.memory.getMemories();

}

}

