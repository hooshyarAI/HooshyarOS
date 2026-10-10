import { AutonomousOperationsEngine } from "../Engines/AutonomousOperationsEngine";

describe("AutonomousOperationsEngine", () => {
    it("owns the canonical autonomous operations boundary", () => {
        const engine = new AutonomousOperationsEngine();
        expect(engine.name).toBe("AutonomousOperationsEngine");
        expect(engine.health()).toBe(true);
        expect(engine.execute("continue mission").status).toBe("READY");
    });

    it("blocks an empty operation", () => {
        expect(new AutonomousOperationsEngine().execute(" ").status).toBe("BLOCKED");
    });
    it("calculates earliest/latest times, float and one deterministic critical path", () => {
        const result = new AutonomousOperationsEngine().planProjectSchedule("factory-upgrade", [
            { id: "A", duration: 3 },
            { id: "B", duration: 2, dependencies: ["A"] },
            { id: "C", duration: 4, dependencies: ["A"] },
            { id: "D", duration: 2, dependencies: ["B", "C"] }
        ]);

        expect(result.status).toBe("READY");
        expect(result.qualification).toBe("REVIEW_REQUIRED");
        expect(result.requiresHumanReview).toBe(true);
        expect(result.projectDuration).toBe(9);
        expect(result.criticalPath).toEqual(["A", "C", "D"]);
        expect(result.criticalActivities).toEqual(["A", "C", "D"]);
        expect(result.activities.find(activity => activity.id === "B")).toEqual(expect.objectContaining({
            earliestStart: 3,
            earliestFinish: 5,
            latestStart: 5,
            latestFinish: 7,
            totalFloat: 2,
            isCritical: false
        }));
        expect(result.activities.find(activity => activity.id === "D")).toEqual(expect.objectContaining({
            earliestStart: 7,
            earliestFinish: 9,
            latestStart: 7,
            latestFinish: 9,
            totalFloat: 0,
            isCritical: true
        }));
        expect(result.provenance.verificationStatus).toBe("PENDING");
        expect(result.provenance.sourceRef).toBe("AutonomousOperationsEngine");
        expect(result.provenance.inputHash).toMatch(/^[a-f0-9]{64}$/);
        expect(result.provenance.outputHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("blocks empty projects and missing project identity", () => {
        const engine = new AutonomousOperationsEngine();
        expect(engine.planProjectSchedule("p1", []).reason).toBe("PROJECT_ACTIVITIES_REQUIRED");
        expect(engine.planProjectSchedule(" ", [{ id: "A", duration: 1 }]).reason).toBe("PROJECT_ID_REQUIRED");
    });

    it("blocks duplicate activities, unknown dependencies and dependency cycles", () => {
        const engine = new AutonomousOperationsEngine();
        expect(engine.planProjectSchedule("p1", [
            { id: "A", duration: 1 }, { id: "A", duration: 2 }
        ]).reason).toBe("DUPLICATE_ACTIVITY_ID");
        expect(engine.planProjectSchedule("p1", [
            { id: "A", duration: 1, dependencies: ["missing"] }
        ]).reason).toBe("UNKNOWN_DEPENDENCY");
        expect(engine.planProjectSchedule("p1", [
            { id: "A", duration: 1, dependencies: ["B"] },
            { id: "B", duration: 1, dependencies: ["A"] }
        ]).reason).toBe("DEPENDENCY_CYCLE");
    });

    it("blocks non-finite and negative durations and does not mutate input", () => {
        const engine = new AutonomousOperationsEngine();
        const activities = [{ id: "A", duration: 2 }, { id: "B", duration: 0, dependencies: ["A"] }];
        const original = JSON.stringify(activities);
        const result = engine.planProjectSchedule("p1", activities);
        expect(result.status).toBe("READY");
        expect(JSON.stringify(activities)).toBe(original);
        expect(engine.planProjectSchedule("p1", [{ id: "A", duration: Number.NaN }]).reason)
            .toBe("ACTIVITY_DURATION_INVALID");
        expect(engine.planProjectSchedule("p1", [{ id: "A", duration: -1 }]).reason)
            .toBe("ACTIVITY_DURATION_INVALID");
    });

    it("blocks duplicate and self dependencies", () => {
        const engine = new AutonomousOperationsEngine();
        expect(engine.planProjectSchedule("p1", [
            { id: "A", duration: 1, dependencies: ["B", "B"] },
            { id: "B", duration: 1 }
        ]).reason).toBe("DUPLICATE_DEPENDENCY");
        expect(engine.planProjectSchedule("p1", [
            { id: "A", duration: 1, dependencies: ["A"] }
        ]).reason).toBe("SELF_DEPENDENCY");
    });
});
