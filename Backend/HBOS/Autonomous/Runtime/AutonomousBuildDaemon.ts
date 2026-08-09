import { AutonomousDevelopmentLoop } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousProjectMission } from "./AutonomousProjectMission";
import { createLocalConstructionTools } from "./LocalConstructionToolset";

export interface DaemonOptions {
    root?: string;
    maxCycles?: number;
    reportEvery?: number;
}

/**
 * Local autonomous construction entry point.
 *
 * It observes the repository, derives the next architecture-driven mission,
 * executes build/verify/repair/finalize, and repeats after a successful
 * repository change. The daemon never changes architecture policy itself.
 */
export class AutonomousBuildDaemon {
    private readonly mission: AutonomousProjectMission;
    private readonly development: AutonomousDevelopmentLoop;
    private readonly maxCycles: number;
    private readonly reportEvery: number;

    constructor(options: DaemonOptions = {}) {
        const root = options.root || process.cwd();
        this.mission = new AutonomousProjectMission(root);
        this.development = new AutonomousDevelopmentLoop(createLocalConstructionTools(root));
        this.maxCycles = options.maxCycles ?? 1000;
        this.reportEvery = options.reportEvery ?? 1;
    }

    run() {
        const history: unknown[] = [];

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

            const result = this.development.execute({
                capabilityId: mission.capabilityId,
                capability: mission.capability,
                targetEngine: mission.targetEngine,
                dependencies: []
            });

            history.push({ cycle, commit: before.commit, mission: mission.capability, result });

            if (cycle % this.reportEvery === 0) {
                console.log(JSON.stringify({
                    type: "AUTONOMOUS_PROGRESS",
                    cycle,
                    latestCommit: this.mission.snapshot().commit,
                    status: result.status
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
                    message: "No repository change was produced by the current construction capability."
                }));
                return { status: "idle", cycles: cycle, history };
            }
        }

        console.log(JSON.stringify({
            type: "AUTONOMOUS_CYCLE_LIMIT",
            cycles: this.maxCycles
        }));

        return { status: "cycle_limit", cycles: this.maxCycles, history };
    }
}

if (require.main === module) {
    const result = new AutonomousBuildDaemon().run();
    process.exitCode = result.status === "blocked" ? 1 : 0;
}
