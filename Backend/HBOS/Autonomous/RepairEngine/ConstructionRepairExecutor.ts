import { AutonomousConstructionEngine, ArchitecturePlan } from "../../Builder/Autonomous/AutonomousConstructionEngine";
import { createLocalConstructionTools } from "../Runtime/LocalConstructionToolset";
import { RepairExecutionPort, RepairExecutionResult, RepairPlan } from "./AutonomousRepairEngine";

export class ConstructionRepairExecutor implements RepairExecutionPort {
    constructor(
        private readonly root = process.cwd(),
        private readonly build: (plan: ArchitecturePlan) => ReturnType<AutonomousConstructionEngine["build"]> = plan =>
            new AutonomousConstructionEngine(createLocalConstructionTools()).build(plan)
    ) {}

    execute(plan: RepairPlan): RepairExecutionResult {
        const capabilityId = plan.capabilityId || "autonomous-repair-recovery";
        const architecturePlan: ArchitecturePlan = {
            capabilityId: `repair-${capabilityId}`,
            capability: `Repair the same capability knot. Root cause: ${plan.issue}. Target: ${plan.targetFile || "unknown"}. Required action: ${plan.action}`,
            targetEngine: "Autonomous Operations Engine",
            dependencies: [],
            architectureRules: [
                "Architecture Freeze V4",
                "One Capability = One Engine = One Test = One Commit",
                "Platform-First Repair Doctrine",
                "Failure-Theory Governance"
            ],
            operation: "ASSISTANT_SELF_REPAIR"
        };

        const result = this.build(architecturePlan);
        const verified = result.ok;
        return {
            repaired: verified,
            plan,
            evidence: {
                repaired: verified,
                verificationPassed: verified,
                integrationVerified: verified,
                architectureVerified: verified,
                failureTheoryAssessed: verified,
                artifact: {
                    controlPlane: "AutonomousConstructionEngine",
                    constructionResult: result,
                    root: this.root
                },
                reason: verified ? undefined : "REPAIR_CONSTRUCTION_BLOCKED"
            }
        };
    }
}
