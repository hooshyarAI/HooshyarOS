import { AutonomousRepairEngine } from "../../Autonomous/RepairEngine/AutonomousRepairEngine";

export type ConstructionStage = "ARCHITECTURE" | "PLAN" | "GENERATE" | "VERIFY" | "REPAIR" | "FINALIZE";

export interface ArchitecturePlan {
    capabilityId: string;
    capability: string;
    targetEngine: string;
    dependencies: string[];
    architectureRules: string[];
}

export interface ConstructionContext {
    plan: ArchitecturePlan;
    stage: ConstructionStage;
    attempt: number;
    artifacts: Record<string, unknown>;
    issues: string[];
}

export interface ConstructionResult {
    ok: boolean;
    status: "BUILT" | "REPAIRED" | "BLOCKED";
    stage: ConstructionStage;
    attempts: number;
    selectedTool: string;
    issues: string[];
    trace: ConstructionStage[];
    details: string;
}

export interface ConstructionTool {
    name: string;
    execute(
        stage: ConstructionStage,
        context: ConstructionContext
    ): {
        ok: boolean;
        artifact?: unknown;
        issue?: string;
    };
}

/** Architecture-driven construction control plane. */
export class AutonomousConstructionEngine {
    constructor(
        private readonly tools: ConstructionTool[],
        private readonly maxRepairAttempts = 3,
        private readonly repairEngine = new AutonomousRepairEngine()
    ) {}

    build(plan: ArchitecturePlan): ConstructionResult {
        const trace: ConstructionStage[] = [];
        const issues: string[] = [];
        const artifacts: Record<string, unknown> = {};

        if (!plan.capabilityId || !plan.capability || !plan.targetEngine) {
            return this.blocked("ARCHITECTURE", 0, ["INVALID_ARCHITECTURE_PLAN"], trace);
        }

        let attempt = 0;
        for (const stage of ["ARCHITECTURE", "PLAN", "GENERATE"] as ConstructionStage[]) {
            trace.push(stage);
            const result = this.execute(stage, plan, attempt, artifacts, issues);
            if (!result.ok) {
                issues.push(result.issue || `${stage}_FAILED`);
                return this.blocked(stage, attempt, issues, trace);
            }
            if (result.artifact !== undefined) artifacts[stage] = result.artifact;
        }

        trace.push("VERIFY");
        issues.length = 0;
        let verification = this.execute("VERIFY", plan, attempt, artifacts, issues);

        while (!verification.ok && attempt < this.maxRepairAttempts) {
            attempt += 1;
            trace.push("REPAIR");
            artifacts.REPAIR_PLAN = this.repairEngine.createPlan(
                verification.issue || "VERIFY_FAILED",
                JSON.stringify(verification)
            );

            const repair = this.execute("REPAIR", plan, attempt, artifacts, issues);
            if (repair.artifact !== undefined) artifacts.REPAIR = repair.artifact;
            if (!repair.ok) {
                issues.push(repair.issue || "REPAIR_FAILED");
                continue;
            }

            trace.push("VERIFY");
            issues.length = 0;
            verification = this.execute("VERIFY", plan, attempt, artifacts, issues);
            if (verification.ok) {
                return this.success("REPAIRED", attempt, trace);
            }
        }

        if (!verification.ok) {
            issues.push(verification.issue || "VERIFICATION_FAILED");
            return this.blocked("VERIFY", attempt, issues, trace);
        }

        trace.push("FINALIZE");
        const finalize = this.execute("FINALIZE", plan, attempt, artifacts, issues);
        if (!finalize.ok) {
            issues.push(finalize.issue || "FINALIZE_FAILED");
            return this.blocked("FINALIZE", attempt, issues, trace);
        }

        return this.success(attempt > 0 ? "REPAIRED" : "BUILT", attempt, trace);
    }

    private execute(stage: ConstructionStage, plan: ArchitecturePlan, attempt: number, artifacts: Record<string, unknown>, issues: string[]) {
        return this.toolFor(stage).execute(stage, { plan, stage, attempt, artifacts, issues });
    }

    private toolFor(stage: ConstructionStage): ConstructionTool {
        const preferredNames: Record<ConstructionStage, string[]> = {
            ARCHITECTURE: ["architecture"], PLAN: ["architecture", "planner"],
            GENERATE: ["generator", "python"], VERIFY: ["python", "verifier", "test"],
            REPAIR: ["python", "repair"], FINALIZE: ["git", "finalizer"]
        };
        for (const name of preferredNames[stage]) {
            const tool = this.tools.find(candidate => candidate.name === name);
            if (tool) return tool;
        }
        return this.tools[0] || { name: "unavailable", execute: () => ({ ok: false, issue: "NO_CONSTRUCTION_TOOL" }) };
    }

    private success(status: "BUILT" | "REPAIRED", attempts: number, trace: ConstructionStage[]): ConstructionResult {
        return {
            ok: true,
            status,
            stage: "FINALIZE",
            attempts,
            selectedTool: this.toolFor("FINALIZE").name,
            issues: [],
            trace,
            details: `Construction verified and finalized; trace=${trace.join(" -> ")}`
        };
    }

    private blocked(stage: ConstructionStage, attempts: number, issues: string[], trace: ConstructionStage[]): ConstructionResult {
        return {
            ok: false,
            status: "BLOCKED",
            stage,
            attempts,
            selectedTool: this.toolFor(stage).name,
            issues,
            trace,
            details: `Construction blocked at ${stage}; trace=${trace.join(" -> ")}`
        };
    }

    static selfTest(): void {
        let verificationCalls = 0;
        const tools: ConstructionTool[] = [
            { name: "architecture", execute: () => ({ ok: true }) },
            { name: "python", execute: stage => {
                if (stage === "VERIFY") {
                    verificationCalls += 1;
                    return verificationCalls === 1 ? { ok: false, issue: "INTERNAL_CONNECTION_FAILURE" } : { ok: true };
                }
                return { ok: true };
            } },
            { name: "git", execute: () => ({ ok: true }) }
        ];
        const result = new AutonomousConstructionEngine(tools, 2).build({
            capabilityId: "construction-001", capability: "architecture-driven autonomous construction",
            targetEngine: "Autonomous Operations Engine", dependencies: ["Architecture Brain", "Governance Engine"],
            architectureRules: ["Architecture Freeze V4", "One Capability = One Engine"]
        });
        if (!result.ok || result.status !== "REPAIRED" || result.attempts !== 1 || !result.details) {
            throw new Error("AutonomousConstructionEngine self-test failed");
        }
    }
}
