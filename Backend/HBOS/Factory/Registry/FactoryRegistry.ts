export class FactoryRegistry {

private items:any[]=[];

register(item:any){

this.items.push(item);

}

list(){

return this.items;

}

}

