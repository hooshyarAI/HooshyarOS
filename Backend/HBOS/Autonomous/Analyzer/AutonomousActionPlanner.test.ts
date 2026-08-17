import { AutonomousActionPlanner } from "./AutonomousActionPlanner";

describe("AutonomousActionPlanner", () => {
    const planner = new AutonomousActionPlanner();

    it("plans artifact creation for missing repository evidence", () => {
        expect(planner.plan([
            {
                name: "backup",
                stage: "DOCUMENTED",
                blockers: ["Next stage requires IMPLEMENTED verification"],
                missingPaths: ["ops/backup.ts"],
                priority: "P0",
            },
        ])).toEqual([
            {
                capability: "backup",
                action: "CREATE_ARTIFACT",
                priority: "P0",
                targets: ["ops/backup.ts"],
                executionAllowed: true,
            },
        ]);
    });

    it("plans behavioral verification without promoting implementation evidence", () => {
        expect(planner.plan([
            {
                name: "financial-ingestion",
                stage: "IMPLEMENTED",
                blockers: ["Next stage requires BEHAVIORALLY_VERIFIED verification"],
                missingPaths: [],
                priority: "P1",
            },
        ])[0]).toEqual({
            capability: "financial-ingestion",
            action: "RUN_BEHAVIORAL_VERIFICATION",
            priority: "P1",
            targets: [],
            executionAllowed: true,
        });
    });

    it("never schedules work for a commercial-ready capability", () => {
        expect(planner.plan([
            {
                name: "ready-capability",
                stage: "COMMERCIAL_READY",
                blockers: [],
                missingPaths: [],
                priority: "P2",
            },
        ])[0]).toEqual({
            capability: "ready-capability",
            action: "NO_ACTION",
            priority: "P2",
            targets: [],
            executionAllowed: false,
        });
    });

    it("orders plans by explicit priority", () => {
        const result = planner.plan([
            { name: "p2", stage: "IMPLEMENTED", blockers: [], missingPaths: [], priority: "P2" },
            { name: "p0", stage: "IMPLEMENTED", blockers: [], missingPaths: [], priority: "P0" },
            { name: "p1", stage: "IMPLEMENTED", blockers: [], missingPaths: [], priority: "P1" },
        ]);

        expect(result.map((item) => item.capability)).toEqual(["p0", "p1", "p2"]);
    });
});
