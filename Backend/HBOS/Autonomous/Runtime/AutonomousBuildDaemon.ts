import { AutonomousMemoryEngine } from "../../Engines/AutonomousMemoryEngine";`r`n`r`nimport { AutonomousDevelopmentLoop } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousMemoryEngine } from "../../Engines/AutonomousMemoryEngine";`r`n`r`nimport { AutonomousProjectMission } from "./AutonomousProjectMission";
import { AutonomousMemoryEngine } from "../../Engines/AutonomousMemoryEngine";`r`n`r`nimport { createLocalConstructionTools } from "./LocalConstructionToolset";

export interface DaemonOptions {
    root?: string;
    maxCycles?: number;
    reportEvery?: number;
}

/**
 * Long-running local construction loop.
 * It observes the repository, derives the next mission, delegates implementation,
 * verifies it, repairs failures, commits/pushes successful work, then replans.
 */
export class AutonomousBuildDaemon {`r`n`r`n    private memory=new AutonomousMemoryEngine();
    private readonly mission: AutonomousProjectMission;
    private readonly development: AutonomousDevelopmentLoop;
    private readonly maxCycles: number;
    private readonly reportEvery: number;

    constructor(options: DaemonOptions = {}) {
        const root = options.root || process.cwd();
        this.mission = new AutonomousProjectMission(root);
        this.development = new AutonomousDevelopmentLoop(createLocalConstructionTools(root));
        this.maxCycles = options.maxCycles ?? 1000;
        this.reportEvery = options.reportEvery ?? 50;
    }

    run() {
        const history: unknown[] = [];

        for (let cycle = 1; cycle <= this.maxCycles; cycle += 1) {
            const before = this.mission.snapshot();
            const mission = this.mission.nextMission();
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
                    completedCycles: cycle,
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
                console.log(JSON.stringify({ type: "AUTONOMOUS_COMPLETE", cycle, commit: after.commit }));
                return { status: "complete", cycles: cycle, history };
            }
        }

        return { status: "cycle_limit", cycles: this.maxCycles, history };
    }
}

if (require.main === module) {
    const result = new AutonomousBuildDaemon().run();
    process.exitCode = result.status === "blocked" ? 1 : 0;
}


