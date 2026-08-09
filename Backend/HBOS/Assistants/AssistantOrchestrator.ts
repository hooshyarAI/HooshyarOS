import { FaceRegistry } from "./FaceRegistry";

export class AssistantOrchestrator {

    private registry=new FaceRegistry();


    initialize(){

        this.registry.initialize();

    }


    route(input:string){

        const text=input.toLowerCase();


        if(text.includes("مالی") || text.includes("سود"))
            return "FinancialFace";


        if(text.includes("مالیات"))
            return "TaxFace";


        if(text.includes("ریسک"))
            return "RiskFace";


        if(text.includes("استراتژی"))
            return "StrategyFace";


        if(text.includes("تصمیم"))
            return "DecisionFace";


        return "AssistantFace";

    }


    execute(input:string){

        const face=this.route(input);


        return {

            face,

            result:this.registry.route(
                face,
                input
            )

        };

    }

}

