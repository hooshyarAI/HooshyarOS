import { AutonomousPerformanceBudget } from "../Autonomous/Runtime/AutonomousPerformanceBudget";

describe("AutonomousPerformanceBudget", () => {
    it("tracks cycle latency and remaining seven-day budget", () => {
        let now = 1_000;
        const budget = new AutonomousPerformanceBudget({ deadlineMs: 10_000, clock: () => now });

        const cycle = budget.beginCycle();
        now += 250;
        const snapshot = budget.completeCycle(cycle);

        expect(snapshot.elapsedMs).toBe(250);
        expect(snapshot.remainingMs).toBe(9_750);
        expect(snapshot.cycleCount).toBe(1);
        expect(snapshot.averageCycleElapsedMs).toBe(250);
        expect(snapshot.deadlineExceeded).toBe(false);
    });

    it("hard-stops when the seven-day deadline is exceeded", () => {
        let now = 0;
        const budget = new AutonomousPerformanceBudget({ deadlineMs: 100, clock: () => now });
        now = 101;

        expect(() => budget.assertWithinDeadline()).toThrow("AUTONOMOUS_BUILD_DEADLINE_EXCEEDED:101");
    });
});
