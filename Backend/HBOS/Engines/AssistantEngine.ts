import { Project } from "../Entities/Project";
import { DecisionEngine } from "./DecisionEngine";
import { AssistantMemory } from "../Entities/AssistantMemory";
import { AssistantResponse } from "../Entities/AssistantResponse";
import { DecisionContext } from "../Core/DecisionContext";


export class AssistantEngine {

    name: string = "AssistantEngine";

    private decisionEngine: DecisionEngine;

    private memory: AssistantMemory;

    constructor() {
        this.decisionEngine = new DecisionEngine();
        this.memory = new AssistantMemory();
    }

    initialize(): void {
        console.log("Assistant Engine Started");
    }

    health(): boolean {
        return true;
    }

    /**
     * Analyze a project and produce a response with evidence preservation.
     *
     * @param project - The project to analyze
     * @param evidence - Optional reasoning evidence from DecisionContext
     * @returns AssistantResponse with preserved evidence
     */
    analyzeProject(
        project: Project,
        evidence?: DecisionContext
    ): AssistantResponse {
        // Pass evidence to DecisionEngine without coupling to ReasoningEngine
        const decision = this.decisionEngine.decide(project, evidence);

        this.memory.store(project.name);

        // Use actual confidence from evidence, undefined when unavailable
        const confidence = decision.confidence;

        // Preserve evidence from decision result
        return new AssistantResponse(
            project,
            decision.message,
            confidence,
            // Reconstruct DecisionContext from decision evidence for preservation
            DecisionContext.fromEvidence({
                traceId: decision.traceId,
                inputHash: decision.inputHash,
                reasoningRef: decision.reasoningRef,
                explanation: decision.explanation,
                confidence: decision.confidence,
                limitations: decision.limitations
            })
        );
    }

}
