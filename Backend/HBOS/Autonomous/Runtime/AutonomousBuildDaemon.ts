import { AutonomousDevelopmentLoop } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousProjectMission } from "./AutonomousProjectMission";
import { AutonomousPlatformContinuation } from "./AutonomousPlatformContinuation";
import { createLocalConstructionTools } from "./LocalConstructionToolset";

export interface DaemonOptions {
    root?: string;
    maxCycles?: number;
    reportEvery?: number;
}

export class AutonomousBuildDaemon {
    private readonly mission: AutonomousProjectMission;
    private readonly continuation: AutonomousPlatformContinuation;
    private readonly development: AutonomousDevelopmentLoop;
    private readonly maxCycles: number;
    private readonly reportEvery: number;

    constructor(options: DaemonOptions = {}) {
        const root = options.root || process.cwd();
        this.mission = new AutonomousProjectMission(root);
        this.continuation = new AutonomousPlatformContinuation();
        this.development = new AutonomousDevelopmentLoop(createLocalConstructionTools(root));
        this.maxCycles = options.maxCycles ?? 1000;
        this.reportEvery = options.reportEvery ?? 1;
    }

    run() {
        const history: unknown[] = [];
        let assistantGatePassed = false;

        for (let cycle = 1; cycle <= this.maxCycles; cycle += 1) {
            const before = this.mission.snapshot();
            const mission = this.mission.nextMission();

            console.log(JSON.stringify({
                type: "AUTONOMOUS_MISSION",
                cycle,
                commit: before.commit,
                capability: mission.capability,
                targetEngine: mission.targetEngine
            }));

            if (mission.capabilityId === "assistant.completion.gate") {
                assistantGatePassed = true;
                console.log(JSON.stringify({
                    type: "ASSISTANT_COMPLETION_GATE",
                    cycle,
                    commit: before.commit,
                    status: "PASSED",
                    message: "All current canonical Assistant construction capabilities are present and the repository is clean."
                }));

                // The completion gate is evidence only. The continuation object
                // must select the next real platform capability; it is never
                // submitted to the Builder as a fake capability.
                const continuation = this.continuation.createMission();
                const nextPlatform = this.continuation.selectNextCapability(this.mission);
                if (!nextPlatform) {
                    console.log(JSON.stringify({
                        type: "AUTONOMOUS_PLATFORM_COMPLETE",
                        cycle,
                        commit: before.commit,
                        status: "completed",
                        continuation,
                        message: "Assistant completion gate passed and the canonical platform backlog is exhausted."
                    }));
                    return { status: "completed", cycles: cycle, history };
                }

                console.log(JSON.stringify({
                    type: "AUTONOMOUS_PLATFORM_CONTINUATION",
                    cycle,
                    continuation,
                    mission: nextPlatform
                }));

                const result = this.development.execute(nextPlatform);
                history.push({ cycle, commit: before.commit, mission: nextPlatform.capability, assistantGatePassed, result });

                if (cycle % this.reportEvery === 0) {
                    console.log(JSON.stringify({
                        type: "AUTONOMOUS_PROGRESS",
                        cycle,
                        latestCommit: this.mission.snapshot().commit,
                        status: result.status,
                        assistantGatePassed
                    }));
                }

                if (!result.result.ok) {
                    console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, result }));
                    return { status: "blocked", cycles: cycle, history };
                }

                continue;
            }

            const result = this.development.execute({
                capabilityId: mission.capabilityId,
                capability: mission.capability,
                targetEngine: mission.targetEngine,
                dependencies: mission.dependencies
            });

            history.push({
                cycle,
                commit: before.commit,
                mission: mission.capability,
                assistantGatePassed,
                result
            });

            if (cycle % this.reportEvery === 0) {
                console.log(JSON.stringify({
                    type: "AUTONOMOUS_PROGRESS",
                    cycle,
                    latestCommit: this.mission.snapshot().commit,
                    status: result.status,
                    assistantGatePassed
                }));
            }

            if (!result.result.ok) {
                console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, result }));
                return { status: "blocked", cycles: cycle, history };
            }

            const after = this.mission.snapshot();
            if (after.commit === before.commit && after.clean) {
                console.log(JSON.stringify({
                    type: "AUTONOMOUS_IDLE",
                    cycle,
                    commit: after.commit,
                    message: "No repository change was produced by the selected construction capability."
                }));
                return { status: "idle", cycles: cycle, history };
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
