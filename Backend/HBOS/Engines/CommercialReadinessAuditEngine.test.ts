import { CommercialReadinessAuditEngine } from "./CommercialReadinessAuditEngine";

describe("CommercialReadinessAuditEngine", () => {
    it("never reports commercial readiness while evidence blockers remain", () => {
        const result = new CommercialReadinessAuditEngine().audit(process.cwd());
        expect(result.commercialReady).toBe(false);
        expect(result.blockers).toEqual(expect.arrayContaining([
            "deployment-verification",
            "operational-observability-verification",
            "commercial-controls",
        ]));
        expect(result.externalDependencies).toContain("production infrastructure");
    });
});
