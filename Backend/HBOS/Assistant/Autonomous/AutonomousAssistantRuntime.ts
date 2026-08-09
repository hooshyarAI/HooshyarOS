import {PersistentArchitectureMemory} from "./PersistentArchitectureMemory";
import {DecisionKnowledgeStore} from "./DecisionKnowledgeStore";
import {ContextRetrievalEngine} from "./ContextRetrievalEngine";
import {CloudReasoningAdapter} from "./CloudReasoningAdapter";
import {LearningFeedbackLoop} from "./LearningFeedbackLoop";

export class AutonomousAssistantRuntime {


memory=new PersistentArchitectureMemory();

knowledge=new DecisionKnowledgeStore();

context=new ContextRetrievalEngine();

reasoner=new CloudReasoningAdapter();

learning=new LearningFeedbackLoop();


async execute(goal:string){

const ctx=this.context.retrieve(goal);

const reasoning=
await this.reasoner.reason(goal);


const result={

goal,

ctx,

reasoning

};


this.memory.save(result);

this.knowledge.add(result);

this.learning.learn(result);


return result;

}


}

