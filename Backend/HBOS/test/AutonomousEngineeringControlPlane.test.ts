import { AutonomousEngineeringControlPlane } from "../Autonomous/Runtime/AutonomousEngineeringControlPlane";

describe("AutonomousEngineeringControlPlane", () => {
    it("blocks missing or contradictory evidence before any repair", () => {
        const result = new AutonomousEngineeringControlPlane().plan([
            {
                id: "runtime-1",
                kind: "RUNTIME",
                severity: 5,
                businessImpact: 5,
                recurrence: 1,
                recoverability: 3,
                observed: false,
                postconditionMissing: true,
            },
        ]);

        expect(result.status).toBe("BLOCKED");
        expect(result.next?.action).toBe("BLOCK_AND_PRESERVE");
    });

    it("repairs the construction process before product capabilities when the process is the root cause", () => {
        const result = new AutonomousEngineeringControlPlane().plan([
            {
                id: "capability-1",
                kind: "RUNTIME",
                severity: 5,
                businessImpact: 5,
                recurrence: 1,
                recoverability: 3,
                observed: true,
            },
            {
                id: "process-1",
                kind: "PROCESS",
                severity: 3,
                businessImpact: 3,
                recurrence: 5,
                recoverability: 3,
                observed: true,
            },
        ]);

        expect(result.status).toBe("CONTINUE");
        expect(result.work.find(item => item.failureId === "process-1")?.action).toBe("REPAIR_PROCESS");
        expect(result.work.find(item => item.failureId === "capability-1")?.action).toBe("REPAIR_CAPABILITY");
    });

    it("selects canonical-path rebuild instead of allowing a duplicate implementation path", () => {
        const result = new AutonomousEngineeringControlPlane().plan([
            {
                id: "builder-1",
                kind: "BUILD",
                severity: 4,
                businessImpact: 4,
                recurrence: 2,
                recoverability: 2,
                observed: true,
                canonicalPathBroken: true,
            },
        ]);

        expect(result.next?.action).toBe("REBUILD_CANONICAL_PATH");
    });
});
