import { CommercialReadinessAuditEngine } from "./CommercialReadinessAuditEngine";

describe("CommercialReadinessAuditEngine", () => {
    it("never reports commercial readiness without product runtime and UI evidence", () => {
        const result = new CommercialReadinessAuditEngine().audit(process.cwd());
        expect(result.commercialReady).toBe(false);
        expect(result.blockers).toContain("web-ui");
        expect(result.blockers).toContain("deployment-verification");
        expect(result.externalDependencies).toContain("production infrastructure");
    });
});
