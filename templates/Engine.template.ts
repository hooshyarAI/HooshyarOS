export interface IEngine {

    name: string;

    initialize(): void;

    health(): object;

}



export class {{EngineName}}Engine implements IEngine {


    name =
        "{{EngineName}} Engine";



    initialize(): void {

        console.log(
            `${this.name} Started`
        );

    }



    health() {

        return {

            engine: this.name,

            status: "RUNNING",

            healthy: true

        };

    }



}