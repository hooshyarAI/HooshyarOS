import { Project } from "../Entities/Project";
import { DecisionEngine } from "./DecisionEngine";
import { AssistantMemory } from "../Entities/AssistantMemory";
import { AssistantResponse } from "../Entities/AssistantResponse";
import { DecisionContext } from "../Core/DecisionContext";
import { IntelligenceEngine } from "./IntelligenceEngine";
import { IntelligenceInput, IntelligenceContext } from "../Core/IntelligenceContract";
import { DecisionEngine as Phase06DecisionEngine } from "../Decision/DecisionEngine";


export class AssistantEngine {

    name: string = "AssistantEngine";

    private decisionEngine: DecisionEngine;

    private memory: AssistantMemory;

    private intelligenceEngine: IntelligenceEngine;

    private phase06DecisionEngine: Phase06DecisionEngine;

    constructor() {
        this.decisionEngine = new DecisionEngine();
        this.memory = new AssistantMemory();
        this.intelligenceEngine = new IntelligenceEngine();
        this.phase06DecisionEngine = new Phase06DecisionEngine();
    }

    initialize(): void {
        console.log("Assistant Engine Started");
    }

    health(): boolean {
        return true;
    }

    analyzeProject(
        project: Project,
        evidence?: DecisionContext
    ): AssistantResponse {
        const decision = this.decisionEngine.decide(project, evidence);

        this.memory.store(project.name);

        const confidence = decision.confidence;

        return new AssistantResponse(
            project,
            decision.message,
            confidence,
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

    analyzeWithIntelligence(
        input: IntelligenceInput,
        context: IntelligenceContext
    ) {
        const reasoning = this.intelligenceEngine.reason(input, context);

        const decision = this.phase06DecisionEngine.evaluate({
            problem: input.problem,
            objective: "Analyze and decide based on intelligence reasoning",
            assumptions: [],
            reasoning,
            evidence: context.evidenceItems,
            rules: [],
            tenantId: input.tenantId
        });

        return { reasoning, decision };
    }

}
