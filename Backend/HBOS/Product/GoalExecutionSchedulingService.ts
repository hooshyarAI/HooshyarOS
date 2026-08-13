export interface ProductEvidenceResult { status: "READY" | "BLOCKED"; evidence: string[] | number; }

export class GoalExecutionSchedulingService {
    readonly capabilityId = "product.goal-kpi-project-task-scheduling";
    readonly targetEngine = "Organizational Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    schedule(input: string): ProductEvidenceResult {
        const normalized = input?.trim() ?? "";
        if (!normalized) return { status: "BLOCKED", evidence: [] };
        const evidence = input.split("->").map(item => item.trim()).filter(Boolean);
        const complete = Array.isArray(evidence) ? evidence.length > 0 : Number.isFinite(evidence) && evidence > 0;
        return { status: complete ? "READY" : "BLOCKED", evidence };
    }
}
