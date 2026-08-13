import { AutonomousFailureAnalysisEngine } from "../Autonomous/Runtime/AutonomousFailureAnalysisEngine";

describe("AutonomousFailureAnalysisEngine", () => {
    const engine = new AutonomousFailureAnalysisEngine();

    it("splits heterogeneous verification failures into independent repair clusters", () => {
        const result = engine.analyze([
            "FAIL Backend/HBOS/test/CommercialRuntimeServer.test.ts Received: 400",
            "FAIL Backend/HBOS/test/AutonomousConstructionEngine.quality.test.ts QUALITY_BEHAVIOR_UNVERIFIED",
            "FAIL Backend/HBOS/test/FinancialStatementAnalysisService.test.ts TS2307 Cannot find module '../Engines/FinancialStatementAnalysisService'",
            "FAIL Backend/HBOS/test/AutonomousDevelopmentLoop.repair.test.ts Expected completed Received blocked"
        ]);

        expect(result.status).toBe("repairable");
        expect(result.clusters.map(cluster => cluster.repairCapabilityId)).toEqual([
            "repair-product.financial-statement-analysis",
            "repair-commercial-runtime-server",
            "repair-autonomous-construction-quality",
            "repair-autonomous-development-loop"
        ]);
    });

    it("selects the same next repair deterministically from the same evidence", () => {
        const evidence = ["TS2307 Cannot find module '../Engines/FinancialStatementAnalysisService'"];
        const first = engine.selectNext(evidence);
        const second = engine.selectNext(evidence);

        expect(first).toEqual(second);
        expect(first?.repairCapabilityId).toBe("repair-product.financial-statement-analysis");
    });

    it("reports unknown evidence instead of guessing a repair capability", () => {
        expect(engine.analyze(["unclassified failure"]).status).toBe("unknown");
        expect(engine.selectNext(["unclassified failure"])).toBeNull();
    });
});
