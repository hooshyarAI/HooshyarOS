import { AutonomousDevelopmentLoop } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousProjectMission } from "./AutonomousProjectMission";
import { AutonomousPlatformContinuation } from "./AutonomousPlatformContinuation";
import { createLocalConstructionTools } from "./LocalConstructionToolset";

export interface DaemonOptions { root?: string; maxCycles?: number; reportEvery?: number; }

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
        let platformContinuation: any = null;

        for (let cycle = 1; cycle <= this.maxCycles; cycle += 1) {
            const before = this.mission.snapshot();
            const mission = platformContinuation ?? this.mission.nextMission();
            platformContinuation = null;
            console.log(JSON.stringify({ type: "AUTONOMOUS_MISSION", cycle, commit: before.commit, capability: mission.capability, targetEngine: mission.targetEngine }));

            const result = this.development.execute({ capabilityId: mission.capabilityId, capability: mission.capability, targetEngine: mission.targetEngine, dependencies: mission.dependencies });
            history.push({ cycle, commit: before.commit, mission: mission.capability, assistantGatePassed, result });

            if (!result.result.ok) {
                console.log(JSON.stringify({ type: "AUTONOMOUS_BLOCKED", cycle, result }));
                return { status: "blocked", cycles: cycle, history };
            }

            // AutonomousDevelopmentLoop.execute() owns construction verification.
            // Do not invoke the static verifier a second time here: besides duplicating
            // work, that breaks consumers/tests that provide a minimal loop mock.

            if (mission.capabilityId === "assistant.completion.gate") {
                assistantGatePassed = true;
                const continuation = this.continuation.createMission();
                platformContinuation = this.continuation.selectNextCapability(this.mission);
                if (!platformContinuation) {
                    console.log(JSON.stringify({ type: "AUTONOMOUS_PLATFORM_COMPLETE", cycle, status: "completed", continuation }));
                    return { status: "completed", cycles: cycle, history };
                }
                console.log(JSON.stringify({ type: "AUTONOMOUS_PLATFORM_CONTINUATION", cycle, continuation, mission: platformContinuation }));
            }

            const after = this.mission.snapshot();
            // A completion gate is a decision checkpoint, not a construction step.
            // If it successfully selected a real platform capability, the absence of
            // a commit at the gate must not be mistaken for an idle/finished state.
            if (after.commit === before.commit && after.clean && !platformContinuation) {
                console.log(JSON.stringify({ type: "AUTONOMOUS_IDLE", cycle, commit: after.commit, capability: mission.capability, message: "No repository change was produced; refusing to advance as completed." }));
                return { status: "idle", cycles: cycle, history };
            }
            if (cycle % this.reportEvery === 0) console.log(JSON.stringify({ type: "AUTONOMOUS_PROGRESS", cycle, latestCommit: after.commit, status: result.status, assistantGatePassed }));
        }
        console.log(JSON.stringify({ type: "AUTONOMOUS_CYCLE_LIMIT", cycles: this.maxCycles }));
        return { status: "cycle_limit", cycles: this.maxCycles, history };
    }
}

if (require.main === module) {
    const result = new AutonomousBuildDaemon().run();
    process.exitCode = result.status === "blocked" ? 1 : 0;
}
