import { AutonomousDevelopmentLoop, AutonomousDevelopmentResult } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousProjectMission, Mission } from "./AutonomousProjectMission";
import { AutonomousPlatformContinuation, PlatformCapabilityMission, PlatformContinuationMission } from "./AutonomousPlatformContinuation";
import { createLocalConstructionTools } from "./LocalConstructionToolset";

export interface DaemonOptions {
    root?: string;
    maxCycles?: number;
    reportEvery?: number;
    mission?: AutonomousProjectMission;
    continuation?: AutonomousPlatformContinuation;
    development?: AutonomousDevelopmentLoop;
}

type MissionDecision =
    | {
        kind: "mission";
        mission: Mission;
        assistantGatePassed: false;
        continuation?: undefined;
    }
    | {
        kind: "platform-continuation";
        mission: PlatformCapabilityMission;
        assistantGatePassed: true;
        continuation: PlatformContinuationMission;
    }
    | {
        kind: "platform-complete";
        mission: Mission;
        assistantGatePassed: true;
        continuation: PlatformContinuationMission;
    };

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
     * Single autonomous decision boundary.
     *
     * Reasoning/mission selection stays in AutonomousProjectMission,
     * continuation policy stays in AutonomousPlatformContinuation, and the
     * daemon only executes the resulting decision. This prevents the
     * completion gate from ever being executed as if it were a platform
     * capability.
     */
    private selectMission(): MissionDecision {
        const selected = this.mission.nextMission();

        if (selected.capabilityId !== "assistant.completion.gate") {
            return {
                kind: "mission",
                mission: selected,
                assistantGatePassed: false
            };
        }

        const continuation = this.continuation.createMission();
        const nextPlatformMission = this.continuation.selectNextCapability(this.mission);

        if (nextPlatformMission) {
            return {
                kind: "platform-continuation",
                mission: nextPlatformMission,
                assistantGatePassed: true,
                continuation
            };
        }

        return {
            kind: "platform-complete",
            mission: selected,
            assistantGatePassed: true,
            continuation
        };
    }

    run() {
        const history: unknown[] = [];

        for (let cycle = 1; cycle <= this.maxCycles; cycle += 1) {
            const before = this.mission.snapshot();
            const decision = this.selectMission();

            if (decision.kind === "platform-complete") {
                console.log(JSON.stringify({
                    type: "AUTONOMOUS_PLATFORM_COMPLETE",
                    cycle,
                    status: "completed",
                    continuation: decision.continuation
                }));
                return { status: "completed", cycles: cycle, history };
            }

            const mission = decision.mission;

            if (decision.kind === "platform-continuation") {
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

            const goal = {
                capabilityId: mission.capabilityId,
                capability: mission.capability,
                targetEngine: mission.targetEngine,
                dependencies: mission.dependencies
            };
            const result: AutonomousDevelopmentResult = this.development.execute(goal);

            history.push({
                cycle,
                commit: before.commit,
                mission: mission.capability,
                capabilityId: mission.capabilityId,
                targetEngine: mission.targetEngine,
                assistantGatePassed: decision.assistantGatePassed,
                handoff: decision.kind === "platform-continuation" ? decision.continuation : undefined,
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
