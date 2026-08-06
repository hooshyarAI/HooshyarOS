export class BuilderMemoryConnector {


    private memories:any[] = [];


    remember(event:any){

        this.memories.push(event);

    }


    getMemories(){

        return this.memories;

    }


}
