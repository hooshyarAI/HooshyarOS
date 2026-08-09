export class LLMProviderRouter {

route(mode:string){

return {

provider:
mode==="local"
?"local-model"
:"cloud-model"

};

}

}

