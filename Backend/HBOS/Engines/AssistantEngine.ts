import { Project } from "../Entities/Project";
import { DecisionEngine } from "./DecisionEngine";
import { AssistantMemory } from "../Entities/AssistantMemory";
import { AssistantResponse } from "../Entities/AssistantResponse";
import { DecisionContext } from "../Core/DecisionContext";
import { IntelligenceEngine } from "./IntelligenceEngine";
import { KnowledgeEngine } from "./KnowledgeEngine";
import { MemoryEngine } from "../Core/MemoryEngine";
import { IntelligenceInput, IntelligenceContext, IntelligencePipeline } from "../Core/IntelligenceContract";
import { DecisionEngine as Phase06DecisionEngine } from "../Decision/DecisionEngine";


export class AssistantEngine {

    name: string = "AssistantEngine";

    private decisionEngine: DecisionEngine;

    private memory: AssistantMemory;

    private intelligenceEngine: IntelligenceEngine;

    private phase06DecisionEngine: Phase06DecisionEngine;

    private assistantMemoryEngine: MemoryEngine;

    private knowledgeEngine: KnowledgeEngine;

    constructor() {
        this.decisionEngine = new DecisionEngine();
        this.memory = new AssistantMemory();
        this.intelligenceEngine = new IntelligenceEngine();
        this.phase06DecisionEngine = new Phase06DecisionEngine();

        this.assistantMemoryEngine = new MemoryEngine();
        this.knowledgeEngine = new KnowledgeEngine();

        this.assistantMemoryEngine.addListener(this.knowledgeEngine);
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
        this.memory.store(project.name);

        const relevantKnowledge = this.findRelevantKnowledge(project);

        if (relevantKnowledge.length > 0) {
            return this.analyzeWithKnowledge(project, relevantKnowledge, evidence);
        }

        return this.analyzeLegacy(project, evidence);
    }

    private findRelevantKnowledge(project: Project): string[] {
        const knowledge = this.knowledgeEngine.getKnowledge();
        const projectName = project.name.toLowerCase();

        return knowledge
            .filter(k => {
                const titleMatch = k.title.toLowerCase().includes(projectName);
                const descMatch = k.description.toLowerCase().includes(projectName);
                return titleMatch || descMatch;
            })
            .map(k => k.id);
    }

    private analyzeWithKnowledge(
        project: Project,
        relevantKnowledgeIds: string[],
        evidence?: DecisionContext
    ): AssistantResponse {
        const knowledgeItems = this.knowledgeEngine.toKnowledgeItems()
            .filter(k => relevantKnowledgeIds.includes(k.id));

        const input: IntelligenceInput = {
            problem: `Analyze project decision: ${project.name}`,
            data: {
                projectName: project.name,
                projectStatus: project.status
            },
            tenantId: evidence?.traceId ? `tenant:${evidence.traceId}` : undefined
        };

        const context: IntelligenceContext = {
            knowledgeItems,
            evidenceItems: evidence ? [{
                id: evidence.traceId || "unknown",
                type: "decision_context",
                summary: evidence.explanation || "Project decision context",
                sourceRef: `project:${project.id}`
            }] : []
        };

        const reasoning = this.intelligenceEngine.reason(input, context);

        const decision = this.phase06DecisionEngine.evaluate({
            problem: input.problem,
            objective: "Make informed project decision using accumulated knowledge",
            assumptions: [`Project name: ${project.name}`, `Status: ${project.status}`],
            reasoning,
            evidence: context.evidenceItems,
            rules: []
        });

        const numericConfidence = IntelligencePipeline.getConfidenceValue(decision.confidence);

        return new AssistantResponse(
            project,
            decision.decision,
            numericConfidence,
            DecisionContext.fromEvidence({
                traceId: decision.traceId,
                inputHash: decision.inputHash,
                reasoningRef: reasoning?.traceId,
                explanation: `${reasoning?.conclusion || ""} ${decision.decision}`.trim(),
                confidence: numericConfidence,
                limitations: [...(decision.limitations || []), ...(reasoning?.limitations || [])]
            })
        );
    }

    private analyzeLegacy(
        project: Project,
        evidence?: DecisionContext
    ): AssistantResponse {
        const decision = this.decisionEngine.decide(project, evidence);

        return new AssistantResponse(
            project,
            decision.message,
            decision.confidence,
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
