export class BuilderEventBus {


    private events:any[] = [];


    publish(event:any){

        this.events.push(event);

    }


    getEvents(){

        return this.events;

    }


}
