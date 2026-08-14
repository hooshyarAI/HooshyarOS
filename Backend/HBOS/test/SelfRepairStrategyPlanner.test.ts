import { SelfRepairStrategyPlanner } from "../Assistant/Autonomous/SelfRepairStrategyPlanner";

describe("SelfRepairStrategyPlanner", () => {
    it("starts with the smallest sufficient strategy for a simple failure", () => {
        const plan = new SelfRepairStrategyPlanner().plan(null, ["one focused verification failure"]);
        expect(plan.depth).toBe("LOW");
        expect(plan.strategy).toBe("FOCUSED_CANONICAL_REPAIR");
    });

    it("escalates dependency/toolchain failures without jumping directly to redesign", () => {
        const plan = new SelfRepairStrategyPlanner().plan(
            { id: "android", rootCause: "Gradle/JDK toolchain failure", repairCapabilityId: "repair-android", priority: 1, evidence: ["Gradle failed"], rationale: "toolchain boundary" },
            ["Gradle failed"]
        );
        expect(plan.depth).toBe("HIGH");
        expect(plan.strategy).toBe("FOCUSED_CANONICAL_REPAIR");
        expect(plan.verification.length).toBeGreaterThan(0);
    });

    it("never repeats an exhausted strategy", () => {
        const planner = new SelfRepairStrategyPlanner();
        const plan = planner.plan(null, ["dependency failure"], ["FOCUSED_CANONICAL_REPAIR", "ARCHITECTURAL_REPAIR", "DEPENDENCY_PROVISIONING"]);
        expect(plan.strategy).toBe("ISOLATION_OR_FALLBACK");
    });
});
