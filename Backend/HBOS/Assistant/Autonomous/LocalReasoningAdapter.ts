import {ReasoningProvider} from "./ReasoningProvider";

export class LocalReasoningAdapter implements ReasoningProvider {

async reason(prompt:string){

return {
provider:"local",
prompt,
success:true
};

}

}
