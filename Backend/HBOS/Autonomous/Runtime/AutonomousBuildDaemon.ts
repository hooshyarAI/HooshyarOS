import { AutonomousDevelopmentLoop, AutonomousDevelopmentResult } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousProjectMission, Mission } from "./AutonomousProjectMission";
import { AutonomousPlatformContinuation, PlatformCapabilityMission } from "./AutonomousPlatformContinuation";
import { createLocalConstructionTools } from "./LocalConstructionToolset";

export interface DaemonOptions {
    root?: string;
    maxCycles?: number;
    reportEvery?: number;
    mission?: AutonomousProjectMission;
    continuation?: AutonomousPlatformContinuation;
    development?: AutonomousDevelopmentLoop;
}

export class AutonomousBuildDaemon {
    private readonly mission: AutonomousProjectMission;
    private readonly continuation: AutonomousPlatformContinuation;
    private readonly development: AutonomousDevelopmentLoop;
    private readonly maxCycles: number;
    private readonly reportEvery: number;

    constructor(options: DaemonOptions = {}) {
        const root = options.root || process.cwd();
        this.mission = options.mission ?? new AutonomousProjectMission(root);
        this.continuation = options.continuation ?? new AutonomousPlatformContinuation();
        this.development = options.development ?? new AutonomousDevelopmentLoop(createLocalConstructionTools(root));
        this.maxCycles = options.maxCycles ?? 1000;
        this.reportEvery = options.reportEvery ?? 1;
    }

    /**
     * Decision boundary: the daemon orchestrates, but never invents a
     * capability. The canonical mission and continuation contracts decide
     * what happens next; execution is delegated afterwards.
     */
    private selectMission(): { mission: Mission | PlatformCapabilityMission; assistantGatePassed: boolean; continuation?: unknown } {
        const selected = this.mission.nextMission();
        if (selected.capabilityId !== "assistant.completion.gate") {
            return { mission: selected, assistantGatePassed: false };
        }

        const continuation = this.continuation.createMission();
        const nextPlatformMission = this.continuation.selectNextCapability(this.mission);
        if (!nextPlatformMission) {
            return { mission: selected, assistantGatePassed: true, continuation };
        }

        return { mission: nextPlatformMission, assistantGatePassed: true, continuation };
    }

    run() {
        const history: unknown[] = [];

        for (let cycle = 1; cycle <= this.maxCycles; cycle += 1) {
            const before = this.mission.snapshot();
            const decision = this.selectMission();
            const mission = decision.mission;

            if (decision.continuation) {
                if (mission.capabilityId === "assistant.completion.gate") {
                    console.log(JSON.stringify({
                        type: "AUTONOMOUS_PLATFORM_COMPLETE",
                        cycle,
                        status: "completed",
                        continuation: decision.continuation
                    }));
                    return { status: "completed", cycles: cycle, history };
                }

                console.log(JSON.stringify({
                    type: "AUTONOMOUS_PLATFORM_CONTINUATION",
                    cycle,
                    continuation: decision.continuation,
                    mission
                }));
            }

            console.log(JSON.stringify({
                type: "AUTONOMOUS_MISSION",
                cycle,
                commit: before.commit,
                capability: mission.capability,
                targetEngine: mission.targetEngine
            }));

            const result: AutonomousDevelopmentResult = this.development.execute({
                capabilityId: mission.capabilityId,
                capability: mission.capability,
                targetEngine: mission.targetEngine,
                dependencies: mission.dependencies
            });

            history.push({
                cycle,
                commit: before.commit,
                mission: mission.capability,
                assistantGatePassed: decision.assistantGatePassed,
                result
            });

            if (!result.result.ok) {
                console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, result }));
                return { status: "blocked", cycles: cycle, history };
            }

            const after = this.mission.snapshot();
            if (after.commit === before.commit && after.clean && cycle < this.maxCycles) {
                console.log(JSON.stringify({
                    type: "AUTONOMOUS_IDLE",
                    cycle,
                    commit: after.commit,
                    capability: mission.capability,
                    message: "No repository change was produced; refusing to advance as completed."
                }));
                return { status: "idle", cycles: cycle, history };
            }

            if (cycle % this.reportEvery === 0) {
                console.log(JSON.stringify({
                    type: "AUTONOMOUS_PROGRESS",
                    cycle,
                    latestCommit: after.commit,
                    status: result.status,
                    assistantGatePassed: decision.assistantGatePassed
                }));
            }
        }

        console.log(JSON.stringify({ type: "AUTONOMOUS_CYCLE_LIMIT", cycles: this.maxCycles }));
        return { status: "cycle_limit", cycles: this.maxCycles, history };
    }
}

if (require.main === module) {
    const result = new AutonomousBuildDaemon().run();
    process.exitCode = result.status === "blocked" ? 1 : 0;
}
