import { FaceRegistry } from "./FaceRegistry";

export class AssistantOrchestrator {

    private registry=new FaceRegistry();


    initialize(){

        this.registry.initialize();

    }


    route(input:string){

        const text=input.toLowerCase();


        if(
            text.includes("tax") ||
            text.includes("vat") ||
            text.includes("irs") ||
            text.includes("مالیات")
        )
            return "TaxFace";


        if(
            text.includes("financial") ||
            text.includes("finance") ||
            text.includes("money") ||
            text.includes("مالی")
        )
            return "FinancialFace";


        if(
            text.includes("risk")
        )
            return "RiskFace";


        if(
            text.includes("strategy")
        )
            return "StrategyFace";


        if(
            text.includes("decision")
        )
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
