import { CommercialReadinessArea, CommercialReadinessEvaluator } from "./CommercialReadinessEvaluator";
import { CapabilityStage } from "./CapabilityGateEvaluator";

const requiredAreas: CommercialReadinessArea[] = [
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

const productionEvidence = (area: CommercialReadinessArea, priority: "P0" | "P1" | "P2" = "P1") => ({
    area,
    stage: "PRODUCTION_VERIFIED" as CapabilityStage,
    evidence: [`verified:${area}`],
    priority,
    required: true,
});

describe("CommercialReadinessEvaluator", () => {
    it("blocks pilot readiness until every required commercial gate has production-grade evidence", () => {
        const evaluator = new CommercialReadinessEvaluator();
        const complete = requiredAreas.map((area) => productionEvidence(area));

        expect(evaluator.evaluate(complete)).toEqual({
            ready: true,
            blockers: [],
            missingAreas: [],
        });

        const withoutSecurity = complete.filter((item) => item.area !== "SECURITY");
        const blocked = evaluator.evaluate(withoutSecurity);

        expect(blocked.ready).toBe(false);
        expect(blocked.missingAreas).toContain("SECURITY");
        expect(blocked.blockers).toContain("SECURITY: production-grade evidence required");
    });
});
