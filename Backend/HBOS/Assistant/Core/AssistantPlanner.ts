export class AssistantPlanner {


    plan(input:string){

        return {

            objective:input,

            steps:[

                "Analyze",
                "Design",
                "Build",
                "Test",
                "Release"

            ]

        };

    }

}
