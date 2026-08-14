import { AutonomousRepairEngine } from "../RepairEngine/AutonomousRepairEngine";

describe("AutonomousRepairEngine", () => {
    test("creates a repair plan with mandatory diagnosis and evidence gates", () => {
        const engine = new AutonomousRepairEngine();
        const plan = engine.createPlan(
            "AUTONOMOUS_VERIFY_FAILED",
            "Backend/HBOS/TestFailure.ts",
        );

        expect(plan.action).toContain("classify root cause");
        expect(plan.action).toContain("rerun verification");
        expect(plan.rootCauseRequired).toBe(true);
        expect(plan.evidenceRequired).toBe(true);
        expect(plan.stopConditions.length).toBeGreaterThan(0);
    });

    test("does not claim repair success without verification evidence", () => {
        const engine = new AutonomousRepairEngine();
        const plan = engine.createPlan("BUILD_FAILED", "Backend/HBOS/TestFailure.ts");

        const result = engine.execute(plan, false);

        expect(result.repaired).toBe(false);
        expect(result.plan.decision).toBe("BLOCKED_WITH_PROOF");
        expect(result.evidence.verification).toContain("verification pending");
    });

    test("selects a new strategy for repeated failures and escalates unknown root causes", () => {
        const engine = new AutonomousRepairEngine();

        expect(engine.chooseDecision(false, true, true)).toBe("RETRY_WITH_NEW_STRATEGY");
        expect(engine.chooseDecision(false, false, false)).toBe("ESCALATE");
        expect(engine.chooseDecision(true, true, true)).toBe("REPAIR");
    });
});
