import { PersistentArchitectureMemory } from "./PersistentArchitectureMemory";
import { DecisionKnowledgeStore } from "./DecisionKnowledgeStore";
import { ContextRetrievalEngine } from "./ContextRetrievalEngine";
import { PythonReasoningAdapter } from "./PythonReasoningAdapter";
import { LearningFeedbackLoop } from "./LearningFeedbackLoop";
import { AutonomousMissionController, MissionRecord } from "./AutonomousMissionController";

/**
 * Canonical runtime boundary for the autonomous Assistant.
 * Mission lifecycle ownership remains in AutonomousMissionController;
 * this runtime owns assistant memory/knowledge/learning integration.
 */
export class AutonomousAssistantRuntime {
    memory = new PersistentArchitectureMemory();
    knowledge = new DecisionKnowledgeStore();
    context = new ContextRetrievalEngine();
    reasoner = new PythonReasoningAdapter();
    learning = new LearningFeedbackLoop();
    missionController = new AutonomousMissionController();

    async execute(goal: string) {
        const ctx = this.context.retrieve(goal);
        const reasoning = await this.reasoner.reason(goal);
        const mission = this.missionController.executeMission(goal);

        const result = {
            goal,
            ctx,
            reasoning,
            mission: mission as MissionRecord
        };

        this.memory.save(result);
        this.knowledge.add(result);
        this.learning.learn(result);
        return result;
    }
}
