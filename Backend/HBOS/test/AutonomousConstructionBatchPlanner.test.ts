import { AutonomousConstructionBatchPlanner } from "../Autonomous/Runtime/AutonomousConstructionBatchPlanner";

describe("AutonomousConstructionBatchPlanner", () => {
    it("groups independent capabilities into the same deterministic batch", () => {
        const planner = new AutonomousConstructionBatchPlanner();
        const batches = planner.plan([
            { capabilityId: "a", owner: "A", dependencies: [] },
            { capabilityId: "b", owner: "B", dependencies: [] },
            { capabilityId: "c", owner: "C", dependencies: ["a"] }
        ]);

        expect(batches).toEqual([
            { batchId: 1, capabilityIds: ["a", "b"] },
            { batchId: 2, capabilityIds: ["c"] }
        ]);
    });

    it("keeps capabilities sharing an owner out of the same batch", () => {
        const planner = new AutonomousConstructionBatchPlanner();
        const batches = planner.plan([
            { capabilityId: "a", owner: "Engine", dependencies: [] },
            { capabilityId: "b", owner: "Engine", dependencies: [] }
        ]);

        expect(batches).toEqual([
            { batchId: 1, capabilityIds: ["a"] },
            { batchId: 2, capabilityIds: ["b"] }
        ]);
    });

    it("fails closed on unresolved dependency cycles", () => {
        const planner = new AutonomousConstructionBatchPlanner();
        expect(() => planner.plan([
            { capabilityId: "a", owner: "A", dependencies: ["b"] },
            { capabilityId: "b", owner: "B", dependencies: ["a"] }
        ])).toThrow("AUTONOMOUS_BATCH_CYCLE_OR_UNRESOLVED_DEPENDENCY");
    });
});
