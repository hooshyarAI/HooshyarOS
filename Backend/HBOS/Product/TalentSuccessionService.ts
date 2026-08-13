export interface ProductEvidenceResult { status: "READY" | "BLOCKED"; evidence: string[] | number; }

export class TalentSuccessionService {
    readonly capabilityId = "product.talent-and-succession";
    readonly targetEngine = "Organizational Intelligence Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    assess(input: string): ProductEvidenceResult {
        const normalized = input?.trim() ?? "";
        if (!normalized) return { status: "BLOCKED", evidence: [] };
        const evidence = input.split(";").map(item => Number(item.split("=")[1] ?? 0)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
        const complete = Array.isArray(evidence) ? evidence.length > 0 : Number.isFinite(evidence) && evidence > 0;
        return { status: complete ? "READY" : "BLOCKED", evidence };
    }
}
