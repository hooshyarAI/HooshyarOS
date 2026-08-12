export interface PerformanceBudgetSnapshot {
    startedAt: number;
    now: number;
    elapsedMs: number;
    remainingMs: number;
    deadlineExceeded: boolean;
    cycleCount: number;
    totalCycleElapsedMs: number;
    averageCycleElapsedMs: number;
}

export interface AutonomousPerformanceBudgetOptions {
    deadlineMs?: number;
    clock?: () => number;
}

/** Enforces the seven-day construction law without coupling it to wall-clock globals. */
export class AutonomousPerformanceBudget {
    static readonly DEFAULT_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

    private readonly startedAt: number;
    private readonly deadlineMs: number;
    private readonly clock: () => number;
    private cycleCount = 0;
    private totalCycleElapsedMs = 0;

    constructor(options: AutonomousPerformanceBudgetOptions = {}) {
        this.clock = options.clock ?? (() => Date.now());
        this.startedAt = this.clock();
        this.deadlineMs = Math.max(1, options.deadlineMs ?? AutonomousPerformanceBudget.DEFAULT_DEADLINE_MS);
    }

    beginCycle(): number {
        return this.clock();
    }

    completeCycle(startedAt: number): PerformanceBudgetSnapshot {
        const now = this.clock();
        const elapsedMs = Math.max(0, now - this.startedAt);
        const cycleElapsedMs = Math.max(0, now - startedAt);
        this.cycleCount += 1;
        this.totalCycleElapsedMs += cycleElapsedMs;

        return this.snapshot(now);
    }

    snapshot(now = this.clock()): PerformanceBudgetSnapshot {
        const elapsedMs = Math.max(0, now - this.startedAt);
        const remainingMs = Math.max(0, this.deadlineMs - elapsedMs);
        return {
            startedAt: this.startedAt,
            now,
            elapsedMs,
            remainingMs,
            deadlineExceeded: elapsedMs >= this.deadlineMs,
            cycleCount: this.cycleCount,
            totalCycleElapsedMs: this.totalCycleElapsedMs,
            averageCycleElapsedMs: this.cycleCount === 0 ? 0 : this.totalCycleElapsedMs / this.cycleCount
        };
    }

    assertWithinDeadline(now = this.clock()): PerformanceBudgetSnapshot {
        const snapshot = this.snapshot(now);
        if (snapshot.deadlineExceeded) {
            throw new Error(`AUTONOMOUS_BUILD_DEADLINE_EXCEEDED:${snapshot.elapsedMs}`);
        }
        return snapshot;
    }
}
