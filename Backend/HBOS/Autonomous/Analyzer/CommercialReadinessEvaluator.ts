import { CapabilityStage } from "./CapabilityGateEvaluator";

export type CommercialReadinessArea =
    | "SECURITY"
    | "AUTHORIZATION"
    | "TENANT_ISOLATION"
    | "DATA_INTEGRITY"
    | "BACKUP_RECOVERY"
    | "CORE_PRODUCT"
    | "INTEGRATION"
    | "PERFORMANCE"
    | "OPERATIONS"
    | "DOCUMENTATION"
    | "PILOT_SCOPE"
    | "SLA"
    | "LEGAL_COMPLIANCE";

export interface CommercialReadinessEvidence {
    area: CommercialReadinessArea;
    stage: CapabilityStage;
    evidence: readonly string[];
    priority: "P0" | "P1" | "P2";
    required: boolean;
}

export interface CommercialReadinessResult {
    ready: boolean;
    blockers: string[];
    missingAreas: CommercialReadinessArea[];
}

const REQUIRED_AREAS: readonly CommercialReadinessArea[] = [
    "SECURITY",
    "AUTHORIZATION",
    "TENANT_ISOLATION",
    "DATA_INTEGRITY",
    "BACKUP_RECOVERY",
    "CORE_PRODUCT",
    "INTEGRATION",
    "PERFORMANCE",
    "OPERATIONS",
    "DOCUMENTATION",
    "PILOT_SCOPE",
    "SLA",
];

const VERIFIED_STAGES: readonly CapabilityStage[] = [
    "PRODUCTION_VERIFIED",
    "COMMERCIAL_READY",
];

export class CommercialReadinessEvaluator {
    evaluate(evidence: readonly CommercialReadinessEvidence[]): CommercialReadinessResult {
        const byArea = new Map(evidence.map((item) => [item.area, item]));
        const blockers: string[] = [];
        const missingAreas: CommercialReadinessArea[] = [];

        for (const area of REQUIRED_AREAS) {
            const item = byArea.get(area);
            if (!item || !item.required || item.evidence.length === 0 || !VERIFIED_STAGES.includes(item.stage)) {
                missingAreas.push(area);
                blockers.push(`${area}: production-grade evidence required`);
            }
        }

        for (const item of evidence) {
            if (item.required && item.priority === "P0" && !VERIFIED_STAGES.includes(item.stage)) {
                const blocker = `${item.area}: P0 gate is not verified`;
                if (!blockers.includes(blocker)) blockers.push(blocker);
            }
        }

        return {
            ready: missingAreas.length === 0,
            blockers,
            missingAreas,
        };
    }
}
