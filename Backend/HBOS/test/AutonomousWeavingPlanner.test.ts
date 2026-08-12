import { AutonomousWeavingPlanner } from "../Autonomous/Runtime/AutonomousWeavingPlanner";

describe("AutonomousWeavingPlanner", () => {
    const planner = new AutonomousWeavingPlanner();

    it("creates an explicit safe build plan in dependency order", () => {
        const plan = planner.plan({
            capabilityId: "platform.budget-intelligence",
            capability: "implement Budget Intelligence",
            targetEngine: "Budget Intelligence Engine",
            dependencies: ["Financial Intelligence Engine"]
        }, true);

        expect(plan.safe).toBe(true);
        expect(plan.action).toBe("BUILD");
        expect(plan.dependencyOrder).toEqual(["Financial Intelligence Engine"]);
        expect(plan.verificationOrder).toEqual([
            "focused test",
            "integration verification",
            "repository evidence audit"
        ]);
        expect(plan.stopConditions).toContain("verification evidence is incomplete");
    });

    it("refuses a new knot when the workspace is dirty", () => {
        const plan = planner.plan({
            capabilityId: "platform.dashboard",
            capability: "implement Dashboard capability",
            targetEngine: "Dashboard Engine",
            dependencies: ["Executive Intelligence Engine"]
        }, false);

        expect(plan.safe).toBe(false);
        expect(plan.rationale).toContain("working tree is dirty");
    });

    it("classifies deployment as high risk without changing canonical order", () => {
        const plan = planner.plan({
            capabilityId: "platform.cloud-deployment",
            capability: "implement repository-native Cloud Deployment capability",
            targetEngine: "Cloud Deployment Engine",
            dependencies: ["Deployment Contract Engine"]
        }, true);

        expect(plan.safe).toBe(true);
        expect(plan.risk).toBe("HIGH");
        expect(plan.capabilityId).toBe("platform.cloud-deployment");
    });
});
