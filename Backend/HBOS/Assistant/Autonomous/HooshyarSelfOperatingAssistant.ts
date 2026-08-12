import { HooshyarAutonomousAssistant } from "./HooshyarAutonomousAssistant";
import { AutonomousDecisionPipeline } from "./AutonomousDecisionPipeline";
import { AutonomousPlanningEngine } from "./AutonomousPlanningEngine";
import { MissionHistoryEngine } from "./MissionHistoryEngine";
import { AssistantHealthMonitor } from "./AssistantHealthMonitor";
import { AutonomousGovernanceController } from "./AutonomousGovernanceController";

export class HooshyarSelfOperatingAssistant {
    private readonly assistant: Pick<HooshyarAutonomousAssistant, "execute">;
    private readonly decision = new AutonomousDecisionPipeline();
    private readonly planning = new AutonomousPlanningEngine();
    private readonly history = new MissionHistoryEngine();
    private readonly health = new AssistantHealthMonitor();
    private readonly governance = new AutonomousGovernanceController();

    constructor(assistant: Pick<HooshyarAutonomousAssistant, "execute"> = new HooshyarAutonomousAssistant()) {
        this.assistant = assistant;
    }

    async runMission(goal: string) {
        const plan = this.planning.plan(goal);
        const governance = this.governance.validate(plan);

        if (!governance.approved) {
            return {
                status: "BLOCKED",
                goal,
                plan,
                decision: {
                    input: plan,
                    decision: "BLOCKED",
                    confidence: 0
                },
                execution: {
                    status: "NOT_EXECUTED"
                },
                health: {
                    healthy: false,
                    status: "BLOCKED"
                }
            };
        }

        const decision = this.decision.decide(plan);
        const execution = await this.assistant.execute(goal);
        const result = {
            status: "COMPLETED",
            goal,
            plan,
            decision,
            execution,
            health: this.health.check()
        };

        this.history.record(result);
        return result;
    }
}
