import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { tmpdir } from "node:os";

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
    statePath?: string;
}

interface PersistedPerformanceState {
    startedAt: number;
    cycleCount: number;
    totalCycleElapsedMs: number;
}

/** Persistent seven-day construction budget; daemon restarts do not reset the deadline. */
export class AutonomousPerformanceBudget {
    static readonly DEFAULT_DEADLINE_MS = 7 * 24 * 60 * 60 * 1000;

    private readonly startedAt: number;
    private readonly deadlineMs: number;
    private readonly clock: () => number;
    private readonly statePath?: string;
    private cycleCount: number;
    private totalCycleElapsedMs: number;

    constructor(options: AutonomousPerformanceBudgetOptions = {}) {
        this.clock = options.clock ?? (() => Date.now());
        this.deadlineMs = Math.max(1, options.deadlineMs ?? AutonomousPerformanceBudget.DEFAULT_DEADLINE_MS);
        this.statePath = this.resolveStatePath(options.statePath);
        const persisted = this.loadState();
        this.startedAt = persisted?.startedAt ?? this.clock();
        this.cycleCount = persisted?.cycleCount ?? 0;
        this.totalCycleElapsedMs = persisted?.totalCycleElapsedMs ?? 0;
        this.persist();
    }

    private resolveStatePath(statePath?: string): string | undefined {
        if (!statePath) return undefined;
        if (!process.env.JEST_WORKER_ID) return statePath;
        const resolved = resolve(statePath);
        const resolvedTmp = resolve(tmpdir());
        return resolved === resolvedTmp || resolved.startsWith(`${resolvedTmp}${sep}`) ? statePath : undefined;
    }

    private loadState(): PersistedPerformanceState | null {
        if (!this.statePath || !existsSync(this.statePath)) return null;
        try {
            return JSON.parse(readFileSync(this.statePath, "utf8")) as PersistedPerformanceState;
        } catch {
            return null;
        }
    }

    private persist(): void {
        if (!this.statePath) return;
        try {
            writeFileSync(this.statePath, JSON.stringify({ startedAt: this.startedAt, cycleCount: this.cycleCount, totalCycleElapsedMs: this.totalCycleElapsedMs }), "utf8");
        } catch {
            // Current-process enforcement remains authoritative when telemetry persistence is unavailable.
        }
    }

    beginCycle(): number {
        return this.clock();
    }

    completeCycle(startedAt: number): PerformanceBudgetSnapshot {
        const now = this.clock();
        const cycleElapsedMs = Math.max(0, now - startedAt);
        this.cycleCount += 1;
        this.totalCycleElapsedMs += cycleElapsedMs;
        this.persist();
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
