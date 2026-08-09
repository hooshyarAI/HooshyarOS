export class CapabilityRegistry {

private capabilities:any[]=[];

register(capability:any){
 this.capabilities.push(capability);
 return true;
}

list(){
 return this.capabilities;
}

}
