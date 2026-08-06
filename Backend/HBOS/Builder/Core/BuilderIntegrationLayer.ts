export class BuilderIntegrationLayer {

private modules:any[] = [];

register(module:any){

    this.modules.push(module);

}

status(){

    return {
        modules:this.modules.length,
        state:"integrated"
    };

}

}
