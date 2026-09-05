import { ProjectDecision } from "../Entities/ProjectDecision";
import { Project } from "../Entities/Project";
import { DecisionContext } from "../Core/DecisionContext";
import { SecurityEventLogger } from "../Entities/SecurityEventLogger";


export class DecisionEngine {

    name: string = "DecisionEngine";

    private securityLogger: SecurityEventLogger | undefined;

    initialize(): void {
        console.log("Decision Engine Started");
    }

    health(): boolean {
        return true;
    }

    setSecurityLogger(logger: SecurityEventLogger): void {
        this.securityLogger = logger;
    }

    decide(
        project: Project,
        evidence?: DecisionContext
    ): ProjectDecision {
        let decision = "Maintain current project direction";

        if (project.status) {
            decision = `Analyze project status: ${project.status}`;
        }

        if (this.securityLogger) {
            this.securityLogger.logAuthorizationPermission({
                target: `project:${project.id}`,
                reason: `Decision made: ${decision}`
            });
        }

        return new ProjectDecision(
            project.status,
            decision,
            evidence
        );
    }

}