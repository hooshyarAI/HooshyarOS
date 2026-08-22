import { ProductionReadinessEvidenceEngine } from "./ProductionReadinessEvidence";

describe("ProductionReadinessEvidenceEngine", () => {
    it("does not claim production verification while any gate is unverified", () => {
        const result = new ProductionReadinessEvidenceEngine().evaluate({
            health: "VERIFIED",
            persistence: "VERIFIED",
            backupRestore: "NOT_VERIFIED",
            observability: "VERIFIED",
            security: "VERIFIED",
            deployment: "NOT_VERIFIED",
            performance: "NOT_VERIFIED",
            endToEnd: "NOT_VERIFIED",
        });

        expect(result.productionVerified).toBe(false);
        expect(result.blockers).toEqual([
            "backupRestore",
            "deployment",
            "performance",
            "endToEnd",
        ]);
    });

    it("only verifies production when every required gate is verified", () => {
        const result = new ProductionReadinessEvidenceEngine().evaluate({
            health: "VERIFIED",
            persistence: "VERIFIED",
            backupRestore: "VERIFIED",
            observability: "VERIFIED",
            security: "VERIFIED",
            deployment: "VERIFIED",
            performance: "VERIFIED",
            endToEnd: "VERIFIED",
        });
        expect(result.productionVerified).toBe(true);
        expect(result.blockers).toEqual([]);
    });
});
