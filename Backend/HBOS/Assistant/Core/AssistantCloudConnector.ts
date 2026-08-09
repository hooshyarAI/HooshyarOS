export class AssistantCloudConnector {


    request(prompt:string){

        return {

            provider:"cloud-ai",

            prompt,

            status:"HEALTHY"

        };

    }

}

