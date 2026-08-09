import {ReasoningProvider} from "./ReasoningProvider";

export class CloudReasoningAdapter implements ReasoningProvider {

async reason(prompt:string){

return {
provider:"cloud",
prompt,
success:true
};

}

}
