import { Engine } from "../Core/Engine";
import { MemoryEngine } from "./MemoryEngine";
import { KnowledgeEngine } from "./KnowledgeEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";
import { ReasoningEngine } from "./ReasoningEngine";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { MemoryEvent } from "../Entities/MemoryEvent";

export interface OrganizationalInsight {
    scope: string;
    status: "READY";
    projectCount: number;
    healthy: boolean;
}

export interface ProcessMetrics {
    cycleTime: number;
    throughput: number;
    errorRate: number;
    capacity: number;
    cost: number;
}

export interface OrganizationalDiagnosis {
    scope: string;
    status: "READY" | "BLOCKED" | "NEEDS_DATA";
    rootCauses: string[];
    affectedProcesses: string[];
    recommendations: string[];
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

export interface ProcessAnalysis {
    scope: string;
    processes: string[];
    bottlenecks: string[];
    cycleTimes: Record<string, number>;
    throughput: Record<string, number>;
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

export interface Bottleneck {
    process: string;
    type: "DELAY" | "DUPLICATION" | "RESOURCE_CONSTRAINT" | "QUALITY";
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    impact: string;
    evidence: string[];
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

export interface ImprovementRecommendation {
    id: string;
    type: "AUTOMATION" | "PROCESS" | "TRAINING" | "TOOLING";
    description: string;
    expectedTimeSaving: number;
    expectedCostImpact: number;
    expectedCapacityRelease: number;
    automationCandidate: boolean;
    confidence: number;
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

export interface LearningRecord {
    metrics: {
        before: ProcessMetrics;
        after: ProcessMetrics;
    };
    timeSaved: number;
    laborCapacityReleased: number;
    operatingCostReduced: number;
    cycleTimeReduced: number;
    errorRateReduced: number;
    throughputIncreased: number;
    decisionLatencyReduced: number;
    qualityImproved: number;
    riskReduced: number;
    capacityCreated: number;
    actualFinancialValue: number;
    actualROI: number;
    sustainability: "SUSTAINABLE" | "PARTIAL" | "NOT_SUSTAINABLE";
    provenance: {
        traceId: string;
        inputHash: string;
        outputHash: string;
        verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
        sourceRef: string;
        reasoningSteps: readonly string[];
    };
}

/** Canonical organizational intelligence owner; composes existing project, memory and knowledge owners. */
export class OrganizationalIntelligenceEngine implements Engine {
    name = "OrganizationalIntelligenceEngine";
    private readonly memory = new MemoryEngine();
    private readonly knowledge = new KnowledgeEngine();
    private readonly projects = new ProjectPilotEngine();
    private readonly reasoning = new ReasoningEngine();

    initialize(): void {
        this.memory.initialize();
        this.knowledge.initialize();
        this.projects.initialize();
        this.reasoning.initialize();
        console.log("OrganizationalIntelligenceEngine Started");
    }

    health(): boolean {
        return true;
    }

    assess(scope = "organization"): OrganizationalInsight {
        return {
            scope,
            status: "READY",
            projectCount: this.projects.getProjects().length,
            healthy: this.health()
        };
    }

    diagnose(scope: string, evidence?: Record<string, unknown>): OrganizationalDiagnosis {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(scope + JSON.stringify(evidence ?? {}));
        const reasoningSteps: string[] = [];

        if (!scope || !scope.trim()) {
            return {
                scope,
                status: "BLOCKED",
                rootCauses: ["Empty scope provided"],
                affectedProcesses: [],
                recommendations: ["Provide a valid organizational scope for diagnosis"],
                provenance: {
                    traceId,
                    inputHash,
                    outputHash: ProvenanceTrace.hashInput("Empty scope"),
                    verificationStatus: "FAILED",
                    sourceRef: "unavailable",
                    reasoningSteps: Object.freeze(["Empty scope is not a valid diagnostic target"])
                }
            };
        }

        if (!evidence || Object.keys(evidence).length === 0) {
            return {
                scope,
                status: "NEEDS_DATA",
                rootCauses: ["No evidence provided for causal analysis"],
                affectedProcesses: [],
                recommendations: ["Supply evidence records for the specified scope"],
                provenance: {
                    traceId,
                    inputHash,
                    outputHash: ProvenanceTrace.hashInput("No evidence"),
                    verificationStatus: "PENDING",
                    sourceRef: "unavailable",
                    reasoningSteps: Object.freeze(["Evidence is required for causal reasoning"])
                }
            };
        }

        reasoningSteps.push("Collected evidence for scope: " + scope);
        reasoningSteps.push("Evidence keys: " + Object.keys(evidence).join(", "));

        const problem = "Diagnose organizational issues in scope: " + scope + ". Evidence: " + JSON.stringify(evidence);
        const reasoningResult = this.reasoning.reason(problem);

        if (!reasoningResult) {
            return {
                scope,
                status: "NEEDS_DATA",
                rootCauses: ["Reasoning engine unavailable"],
                affectedProcesses: [],
                recommendations: ["Retry diagnosis when reasoning engine is available"],
                provenance: {
                    traceId,
                    inputHash,
                    outputHash: ProvenanceTrace.hashInput("reasoning-unavailable"),
                    verificationStatus: "PENDING",
                    sourceRef: "unavailable",
                    reasoningSteps: Object.freeze(["Reasoning engine returned no result"])
                }
            };
        }

        if (reasoningResult.success && reasoningResult.answer) {
            reasoningSteps.push("Reasoning engine produced diagnosis: " + reasoningResult.answer);
            if (reasoningResult.provenance && reasoningResult.provenance.reasoningSteps) {
                reasoningSteps.push(...reasoningResult.provenance.reasoningSteps.filter((s: string) => s !== "unavailable"));
            }

            const rootCauses = this.extractRootCauses(reasoningResult.answer, evidence);
            const affectedProcesses = this.extractAffectedProcesses(reasoningResult.answer, evidence);
            const recommendations = this.extractRecommendations(reasoningResult.answer);

            return {
                scope,
                status: "READY",
                rootCauses,
                affectedProcesses,
                recommendations,
                provenance: {
                    traceId,
                    inputHash,
                    outputHash: ProvenanceTrace.hashInput(reasoningResult.answer),
                    verificationStatus: "VERIFIED",
                    sourceRef: reasoningResult.provenance?.sourceRef ?? "unavailable",
                    reasoningSteps: Object.freeze(reasoningSteps)
                }
            };
        }

        reasoningSteps.push("Reasoning engine failed or returned no answer");
        reasoningSteps.push("Status: " + (reasoningResult?.status ?? "undefined"));

        const rootCauses = this.inferRootCauses(evidence);
        const affectedProcesses = this.inferAffectedProcesses(evidence);
        const recommendations = this.inferRecommendations(evidence);

        return {
            scope,
            status: "NEEDS_DATA",
            rootCauses,
            affectedProcesses,
            recommendations,
            provenance: {
                traceId,
                inputHash,
                outputHash: ProvenanceTrace.hashInput(reasoningResult?.status ?? "undefined"),
                verificationStatus: "PENDING",
                sourceRef: reasoningResult.provenance?.sourceRef ?? "unavailable",
                reasoningSteps: Object.freeze(reasoningSteps)
            }
        };
    }

    analyzeProcesses(scope: string): ProcessAnalysis {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(scope);
        const reasoningSteps: string[] = [];
        const events = this.memory.retrieve();
        const processes: string[] = [];
        const cycleTimes: Record<string, number> = {};
        const throughput: Record<string, number> = {};

        reasoningSteps.push("Analyzing processes for scope: " + scope);

        for (const event of events) {
            if (!scope || event.source.includes(scope) || event.type.includes(scope)) {
                const processName = event.source || event.type;
                if (!processes.includes(processName)) {
                    processes.push(processName);
                }
                cycleTimes[processName] = (cycleTimes[processName] || 0) + 1;
                throughput[processName] = (throughput[processName] || 0) + 1;
            }
        }

        if (processes.length === 0) {
            reasoningSteps.push("No process events found for scope: " + scope);
        } else {
            reasoningSteps.push("Identified " + processes.length + " processes");
        }

        return {
            scope,
            processes,
            bottlenecks: [],
            cycleTimes,
            throughput,
            provenance: {
                traceId,
                inputHash,
                outputHash: ProvenanceTrace.hashInput(JSON.stringify({ processes, cycleTimes, throughput })),
                verificationStatus: processes.length > 0 ? "VERIFIED" : "PENDING",
                sourceRef: "MemoryEngine",
                reasoningSteps: Object.freeze(reasoningSteps)
            }
        };
    }

    detectBottlenecks(scope: string): Bottleneck[] {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(scope);
        const reasoningSteps: string[] = [];
        const events = this.memory.retrieve();
        const results: Bottleneck[] = [];
        const seenKeys = new Set<string>();

        reasoningSteps.push("Detecting bottlenecks for scope: " + scope);

        if (!scope || !scope.trim()) {
            return [{
                process: "unknown",
                type: "RESOURCE_CONSTRAINT",
                severity: "HIGH",
                impact: "Cannot detect bottlenecks without a valid scope",
                evidence: ["Empty scope provided"],
                provenance: {
                    traceId,
                    inputHash,
                    outputHash: ProvenanceTrace.hashInput("Empty scope"),
                    verificationStatus: "FAILED",
                    sourceRef: "unavailable",
                    reasoningSteps: Object.freeze(["Empty scope prevents bottleneck detection"])
                }
            }];
        }

        const internalBottlenecks = this.detectBottlenecksInternal(scope, events);

        for (const b of internalBottlenecks) {
            const key = b.process + "|" + b.type; if (!seenKeys.has(key)) {
                seenKeys.add(key);
                results.push({
                    process: b.process,
                    type: b.type,
                    severity: b.severity,
                    impact: b.impact,
                    evidence: b.evidence,
                    provenance: {
                        traceId,
                        inputHash,
                        outputHash: ProvenanceTrace.hashInput(b.process + b.type + b.severity),
                        verificationStatus: "VERIFIED",
                        sourceRef: "MemoryEngine",
                        reasoningSteps: Object.freeze(reasoningSteps)
                    }
                });
            }
        }

        if (results.length === 0) {
            results.push({
                process: scope,
                type: "RESOURCE_CONSTRAINT",
                severity: "LOW",
                impact: "No bottlenecks detected in current process data",
                evidence: ["Insufficient event data for scope: " + scope],
                provenance: {
                    traceId,
                    inputHash,
                    outputHash: ProvenanceTrace.hashInput("No bottlenecks"),
                    verificationStatus: "PENDING",
                    sourceRef: "MemoryEngine",
                    reasoningSteps: Object.freeze(reasoningSteps)
                }
            });
        }

        return results;
    }

    recommendImprovements(scope: string): ImprovementRecommendation[] {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(scope);
        const reasoningSteps: string[] = [];
        const recommendations: ImprovementRecommendation[] = [];

        reasoningSteps.push("Generating improvement recommendations for scope: " + scope);

        if (!scope || !scope.trim()) {
            return [{
                id: "REC-EMPTY",
                type: "PROCESS",
                description: "Provide a valid scope to generate improvement recommendations",
                expectedTimeSaving: 0,
                expectedCostImpact: 0,
                expectedCapacityRelease: 0,
                automationCandidate: false,
                confidence: 0,
                provenance: {
                    traceId,
                    inputHash,
                    outputHash: ProvenanceTrace.hashInput("Empty scope"),
                    verificationStatus: "FAILED",
                    sourceRef: "unavailable",
                    reasoningSteps: Object.freeze(["Empty scope prevents recommendation generation"])
                }
            }];
        }

        const bottlenecks = this.detectBottlenecks(scope);
        const events = this.memory.retrieve();

        reasoningSteps.push("Found " + bottlenecks.length + " bottlenecks for improvement targeting");

        const seenTypes = new Set<string>();
        let idCounter = 1;

        for (const bottleneck of bottlenecks) {
            const recType = bottleneck.type === "DELAY" ? "PROCESS" :
                           bottleneck.type === "DUPLICATION" ? "AUTOMATION" :
                           bottleneck.type === "RESOURCE_CONSTRAINT" ? "TOOLING" : "TRAINING";

            if (seenTypes.has(recType + bottleneck.process)) continue;
            seenTypes.add(recType + bottleneck.process);

            const timeSaving = bottleneck.severity === "CRITICAL" ? 40 :
                              bottleneck.severity === "HIGH" ? 25 :
                              bottleneck.severity === "MEDIUM" ? 15 : 5;

            const costImpact = bottleneck.severity === "CRITICAL" ? -30 :
                              bottleneck.severity === "HIGH" ? -20 :
                              bottleneck.severity === "MEDIUM" ? -10 : -5;

            const capacityRelease = bottleneck.severity === "CRITICAL" ? 35 :
                                   bottleneck.severity === "HIGH" ? 20 :
                                   bottleneck.severity === "MEDIUM" ? 10 : 3;

            const confidence = events.length > 0 ? 0.75 : 0.5;

            recommendations.push({
                id: "REC-" + idCounter++,
                type: recType,
                description: "Address " + bottleneck.type.toLowerCase() + " in " + bottleneck.process + ": " + bottleneck.impact,
                expectedTimeSaving: timeSaving,
                expectedCostImpact: costImpact,
                expectedCapacityRelease: capacityRelease,
                automationCandidate: recType === "AUTOMATION",
                confidence,
                provenance: {
                    traceId,
                    inputHash,
                    outputHash: ProvenanceTrace.hashInput(recType + bottleneck.process),
                    verificationStatus: "VERIFIED",
                    sourceRef: "OrganizationalIntelligenceEngine",
                    reasoningSteps: Object.freeze([
                        "Identified bottleneck: " + bottleneck.process + " (" + bottleneck.type + ")",
                        "Generated improvement recommendation: " + recType,
                        "Confidence based on event data availability: " + confidence
                    ])
                }
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                id: "REC-" + idCounter++,
                type: "PROCESS",
                description: "No specific improvements identified; review process data for " + scope,
                expectedTimeSaving: 0,
                expectedCostImpact: 0,
                expectedCapacityRelease: 0,
                automationCandidate: false,
                confidence: 0.3,
                provenance: {
                    traceId,
                    inputHash,
                    outputHash: ProvenanceTrace.hashInput("No improvements"),
                    verificationStatus: "PENDING",
                    sourceRef: "OrganizationalIntelligenceEngine",
                    reasoningSteps: Object.freeze(["No bottlenecks detected to drive improvements"])
                }
            });
        }

        return recommendations;
    }

    learnFromExecution(before: ProcessMetrics, after: ProcessMetrics): LearningRecord {
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(JSON.stringify({ before, after }));
        const reasoningSteps: string[] = [];

        reasoningSteps.push("Measuring before/after impact per Organizational Transformation Outcome V1 §7");
        reasoningSteps.push("Before metrics: " + JSON.stringify(before));
        reasoningSteps.push("After metrics: " + JSON.stringify(after));

        const cycleTimeReduced = Math.max(0, before.cycleTime - after.cycleTime);
        const errorRateReduced = Math.max(0, before.errorRate - after.errorRate);
        const throughputIncreased = Math.max(0, after.throughput - before.throughput);
        const capacityCreated = Math.max(0, after.capacity - before.capacity);
        const timeSaved = cycleTimeReduced;
        const operatingCostReduced = Math.max(0, before.cost - after.cost);

        const laborCapacityReleased = throughputIncreased * 0.1 + timeSaved * 0.05;

        const actualFinancialValue = operatingCostReduced + laborCapacityReleased * 100;
        const actualROI = actualFinancialValue > 0 && before.cost > 0 ? actualFinancialValue / before.cost : 0;

        const sustainability = actualFinancialValue > 0 && cycleTimeReduced > 0 && errorRateReduced > 0
            ? "SUSTAINABLE"
            : actualFinancialValue > 0 || cycleTimeReduced > 0
                ? "PARTIAL"
                : "NOT_SUSTAINABLE";

        return {
            metrics: { before, after },
            timeSaved,
            laborCapacityReleased,
            operatingCostReduced,
            cycleTimeReduced,
            errorRateReduced,
            throughputIncreased,
            decisionLatencyReduced: cycleTimeReduced * 0.3,
            qualityImproved: errorRateReduced,
            riskReduced: errorRateReduced * 0.5,
            capacityCreated,
            actualFinancialValue,
            actualROI,
            sustainability,
            provenance: {
                traceId,
                inputHash,
                outputHash: ProvenanceTrace.hashInput(JSON.stringify({
                    timeSaved,
                    laborCapacityReleased,
                    operatingCostReduced,
                    actualFinancialValue,
                    actualROI
                })),
                verificationStatus: "VERIFIED",
                sourceRef: "OrganizationalIntelligenceEngine",
                reasoningSteps: Object.freeze(reasoningSteps)
            }
        };
    }

    private extractRootCauses(answer: string, evidence: Record<string, unknown>): string[] {
        const causes: string[] = [];
        const answerLower = answer.toLowerCase();

        if (answerLower.includes("delay") || evidence.delay) causes.push("Process delay detected");
        if (answerLower.includes("resource") || evidence.resource) causes.push("Resource constraint identified");
        if (answerLower.includes("quality") || evidence.quality) causes.push("Quality issue identified");
        if (answerLower.includes("duplicate") || evidence.duplication) causes.push("Process duplication detected");
        if (causes.length === 0) causes.push("General organizational friction identified by reasoning engine");

        return causes;
    }

    private extractAffectedProcesses(answer: string, evidence: Record<string, unknown>): string[] {
        const processes: string[] = [];
        const answerLower = answer.toLowerCase();

        if (answerLower.includes("approval") || evidence.approval) processes.push("Approval workflow");
        if (answerLower.includes("review") || evidence.review) processes.push("Review process");
        if (answerLower.includes("deploy") || evidence.deploy) processes.push("Deployment pipeline");
        if (answerLower.includes("decision") || evidence.decision) processes.push("Decision making");
        if (processes.length === 0) processes.push("General organizational processes");

        return processes;
    }

    private extractRecommendations(answer: string): string[] {
        const recommendations: string[] = [];
        const answerLower = answer.toLowerCase();

        if (answerLower.includes("automate") || answerLower.includes("automation")) {
            recommendations.push("Consider automation of identified manual steps");
        }
        if (answerLower.includes("training") || answerLower.includes("skill")) {
            recommendations.push("Invest in training and skill development");
        }
        if (answerLower.includes("process") || answerLower.includes("workflow")) {
            recommendations.push("Optimize and standardize workflow processes");
        }
        if (recommendations.length === 0) {
            recommendations.push("Review reasoning engine output for specific improvement actions");
        }

        return recommendations;
    }

    private inferRootCauses(evidence: Record<string, unknown>): string[] {
        const causes: string[] = [];

        if (evidence.delay) causes.push("Delay pattern observed in evidence");
        if (evidence.resource) causes.push("Resource constraint indicated in evidence");
        if (evidence.quality) causes.push("Quality degradation signaled in evidence");
        if (evidence.duplication) causes.push("Duplication detected in evidence");
        if (causes.length === 0) causes.push("Insufficient evidence for root cause determination");

        return causes;
    }

    private inferAffectedProcesses(evidence: Record<string, unknown>): string[] {
        const processes: string[] = [];

        if (evidence.approval) processes.push("Approval workflow");
        if (evidence.review) processes.push("Review process");
        if (evidence.deploy) processes.push("Deployment pipeline");
        if (evidence.decision) processes.push("Decision making");
        if (processes.length === 0) processes.push("General organizational processes");

        return processes;
    }

    private inferRecommendations(evidence: Record<string, unknown>): string[] {
        const recs: string[] = [];

        if (evidence.automation || evidence.duplication) {
            recs.push("Investigate automation opportunities to reduce manual effort");
        }
        if (evidence.resource) {
            recs.push("Assess resource allocation and capacity planning");
        }
        if (evidence.quality) {
            recs.push("Implement quality gates and review mechanisms");
        }
        if (recs.length === 0) {
            recs.push("Collect richer evidence to enable targeted recommendations");
        }

        return recs;
    }

    private detectBottlenecksInternal(
        scope: string,
        events: MemoryEvent[]
    ): Array<{ process: string; type: Bottleneck["type"]; severity: Bottleneck["severity"]; impact: string; evidence: string[] }> {
        const results: Array<{ process: string; type: Bottleneck["type"]; severity: Bottleneck["severity"]; impact: string; evidence: string[] }> = [];
        const processCounts: Record<string, number> = {};
        const sourceCounts: Record<string, number> = {};

        for (const event of events) {
            if (!scope || event.source.includes(scope) || event.type.includes(scope)) {
                const processName = event.source || event.type;
                processCounts[processName] = (processCounts[processName] || 0) + 1;
                sourceCounts[event.source] = (sourceCounts[event.source] || 0) + 1;
            }
        }

        for (const [process, count] of Object.entries(processCounts)) {
            if (count > 5) {
                const severity: Bottleneck["severity"] = count > 20 ? "CRITICAL" :
                                                         count > 10 ? "HIGH" :
                                                         count > 5 ? "MEDIUM" : "LOW";
                results.push({
                    process,
                    type: "DELAY",
                    severity,
                    impact: "High event volume (" + count + ") indicates potential delay or processing bottleneck",
                    evidence: [count + " events recorded for process " + process + " in scope " + scope]
                });
            }
        }

        for (const [source, count] of Object.entries(sourceCounts)) {
            if (count > 3 && !results.some(r => r.process === source && r.type === "DUPLICATION")) {
                results.push({
                    process: source,
                    type: "DUPLICATION",
                    severity: count > 10 ? "HIGH" : "MEDIUM",
                    impact: "Source " + source + " emitted " + count + " events suggesting redundant processing",
                    evidence: [count + " events from source " + source]
                });
            }
        }

        const uniqueProcesses = Object.keys(processCounts).length;
        const totalEvents = Object.values(processCounts).reduce((a, b) => a + b, 0);
        if (uniqueProcesses > 0 && totalEvents / uniqueProcesses > 10 && results.length === 0) {
            results.push({
                process: scope,
                type: "RESOURCE_CONSTRAINT",
                severity: "MEDIUM",
                impact: "Event concentration suggests limited process parallelism",
                evidence: [totalEvents + " events across " + uniqueProcesses + " processes"]
            });
        }

        return results;
    }
}



