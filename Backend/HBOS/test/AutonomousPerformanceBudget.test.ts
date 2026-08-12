import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

    it("persists the deadline and cycle telemetry across daemon restarts", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-budget-"));
        const statePath = join(root, "performance.json");
        try {
            let now = 1_000;
            const first = new AutonomousPerformanceBudget({ deadlineMs: 10_000, statePath, clock: () => now });
            const cycle = first.beginCycle();
            now += 500;
            const firstSnapshot = first.completeCycle(cycle);

            now += 1_000;
            const restarted = new AutonomousPerformanceBudget({ deadlineMs: 10_000, statePath, clock: () => now });
            const secondSnapshot = restarted.snapshot();

            expect(secondSnapshot.startedAt).toBe(firstSnapshot.startedAt);
            expect(secondSnapshot.cycleCount).toBe(1);
            expect(secondSnapshot.totalCycleElapsedMs).toBe(500);
            expect(secondSnapshot.elapsedMs).toBe(1_500);
            expect(secondSnapshot.remainingMs).toBe(8_500);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
