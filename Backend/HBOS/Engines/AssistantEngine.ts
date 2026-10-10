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
import {
    OrchestratedDecisionIntelligenceService,
    OrchestratedInput,
    OrchestratedResult,
} from "../Product/OrchestratedDecisionIntelligenceService";


export class AssistantEngine {

    name: string = "AssistantEngine";

    private decisionEngine: DecisionEngine;

    private memory: AssistantMemory;

    private intelligenceEngine: IntelligenceEngine;

    private phase06DecisionEngine: Phase06DecisionEngine;

    private assistantMemoryEngine: MemoryEngine;

    private knowledgeEngine: KnowledgeEngine;

    private orchestrated: OrchestratedDecisionIntelligenceService;

    constructor(opts?: { orchestrated?: OrchestratedDecisionIntelligenceService }) {
        this.decisionEngine = new DecisionEngine();
        this.memory = new AssistantMemory();
        this.intelligenceEngine = new IntelligenceEngine();
        this.phase06DecisionEngine = new Phase06DecisionEngine();

        this.assistantMemoryEngine = new MemoryEngine();
        this.knowledgeEngine = new KnowledgeEngine();

        this.assistantMemoryEngine.addListener(this.knowledgeEngine);

        this.orchestrated = opts?.orchestrated ?? new OrchestratedDecisionIntelligenceService();
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

    /**
     * Phase 09-activation GAP 1: integrate AssistantEngine with the canonical
     * Orchestrated Decision Intelligence service. AI/LLM remains interpretation
     * only — all deterministic math is delegated to the service. The Assistant
     * composes the result into an `AssistantResponse` with full provenance.
     */
    analyzeAcquisitionOpportunity(
        problem: string,
        orchestratedInput: OrchestratedInput,
        context?: IntelligenceContext
    ): { response: AssistantResponse; orchestrated: OrchestratedResult } {
        if (!orchestratedInput || typeof orchestratedInput.tenantId !== "string" || !orchestratedInput.tenantId.trim()) {
            throw new Error("assistant-orchestration-tenant-required");
        }
        if (!problem || !problem.trim()) {
            throw new Error("assistant-orchestration-problem-required");
        }

        const orchestrated = this.orchestrated.orchestrate(orchestratedInput);

        const qualityQualified = orchestrated.status === "READY" && orchestrated.quality.status === "PASS";
        const confidence = qualityQualified
            ? IntelligencePipeline.fromCalculatedConfidence(
                0.5,
                "deterministic-orchestrated-result",
                "OrchestratedDecisionIntelligenceService passed the calculation and quality gates",
            )
            : IntelligencePipeline.unavailable();

        const qualityLimitations = orchestrated.quality.checks
            .filter(check => check.status !== "PASS")
            .map(check => `${check.id}: ${check.detail}`);
        const limitations: string[] = [
            ...(orchestrated.status === "BLOCKED" ? ["Orchestration is BLOCKED — required calculations or input contracts failed."] : []),
            ...(orchestrated.status === "PARTIAL" ? ["Quality gate requires review before this result can be treated as a final decision."] : []),
            ...(confidence.source === "unavailable" ? ["Decision confidence is unavailable because the quality gate has not qualified this result."] : []),
            ...qualityLimitations,
        ];

        const summaryParts: string[] = [
            `Overall: ${orchestrated.status}; execution: ${orchestrated.executionStatus}; quality: ${orchestrated.quality.status}`
        ];
        if (orchestrated.financial.status === "READY") {
            summaryParts.push(
                `Financial: profit=${orchestrated.financial.profit}, NPV=${orchestrated.financial.npv.toFixed(2)}, IRR=${orchestrated.financial.irr.toFixed(4)}, WACC=${orchestrated.financial.wacc.toFixed(4)}`,
            );
        } else {
            summaryParts.push("Financial: BLOCKED");
        }
        if (orchestrated.risk.status === "READY") {
            summaryParts.push(`Risk: score=${orchestrated.risk.score}`);
        } else {
            summaryParts.push("Risk: BLOCKED");
        }
        if (orchestrated.decision.status === "READY") {
            summaryParts.push(`Decision: AHP consistent=${orchestrated.decision.ahp.consistent}, TOPSIS best=${orchestrated.decision.topsis.bestIndex}`);
        } else if (orchestrated.decision.status === "PARTIAL") {
            summaryParts.push(`Decision: PARTIAL; completed=${orchestrated.decision.execution.methods.join(",")}; blocked=${orchestrated.decision.execution.blockedMethods.join(",") || "none"}`);
        } else {
            summaryParts.push("Decision: BLOCKED");
        }
        const selectedSciences = orchestrated.science?.selected.map(item => item.name).join(", ") ?? "not routed";
        summaryParts.push(`Sciences: ${selectedSciences}`);
        summaryParts.push(`Quality: ${orchestrated.quality.status}; human review required: ${orchestrated.quality.requiresHumanReview}`);
        const explanation = summaryParts.join(" | ");

        // Use the existing assistant reasoning path for *interpretation* only.
        const intelligenceInput: IntelligenceInput = {
            problem,
            data: {
                orchestratedStatus: orchestrated.status,
                executionStatus: orchestrated.executionStatus,
                qualityStatus: orchestrated.quality.status,
                selectedScienceDomains: orchestrated.science?.selected.map(item => item.domainId) ?? [],
                blockedDecisionMethods: orchestrated.decision.execution.blockedMethods,
            },
            tenantId: orchestrated.tenantId,
        };
        const reasoningResult = context
            ? this.intelligenceEngine.reason(intelligenceInput, context)
            : undefined;
        // Narrative reasoning can explain a result, but it cannot override a
        // failed or pending deterministic quality gate to manufacture confidence.
        const numericConfidence = confidence.source === "unavailable" ? 0 : confidence.value;

        // Minimal evidence-only Project shim for the AssistantResponse contract.
        // The AssistantResponse is keyed on Project; the orchestrated call does
        // not have a project entity, so we synthesize a minimal one carrying
        // only the fields AssistantResponse inspects.
        const syntheticProject: Project = {
            id: `orchestration:${orchestrated.tenantId}:${Date.now()}`,
            name: problem,
            status: orchestrated.status,
        } as unknown as Project;

        const response = new AssistantResponse(
            syntheticProject,
            explanation,
            numericConfidence,
            DecisionContext.fromEvidence({
                traceId: reasoningResult?.traceId ?? orchestrated.quality.provenance.traceId,
                inputHash: reasoningResult?.inputHash ?? orchestrated.quality.provenance.inputHash,
                reasoningRef: reasoningResult?.traceId,
                explanation,
                confidence: numericConfidence,
                limitations: [...limitations, ...(reasoningResult?.limitations ?? [])],
            }),
        );

        return { response, orchestrated };
    }

}
