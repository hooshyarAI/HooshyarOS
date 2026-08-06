import { BuilderEngine } from "../Builder/Core/BuilderEngine";

export class EngineRegistry {

    private engines:any[] = [];


    constructor(){

        this.register(
            new BuilderEngine()
        );

    }


    register(
        name:any,
        status?:string
    ){

        if(typeof name === "string"){

            this.engines.push({
                name,
                status: status || "UNKNOWN"
            });

        }
        else{

            this.engines.push(name);

        }

    }


    initialize(){

        this.engines.forEach(
            engine=>{
                if(engine.initialize){
                    engine.initialize();
                }
            }
        );

        return this.engines;

    }


    find(name:string){

        return this.engines.find(
            (engine:any)=>
                engine.name === name ||
                engine.constructor?.name === name
        );

    }


    getEngines(){

        return this.engines;

    }

}