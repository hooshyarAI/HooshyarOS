import { AutonomousRepairEngine } from "../../Autonomous/RepairEngine/AutonomousRepairEngine";

export type ConstructionStage = "ARCHITECTURE" | "PLAN" | "GENERATE" | "VERIFY" | "REPAIR" | "FINALIZE";
export interface ArchitecturePlan { capabilityId: string; capability: string; targetEngine: string; dependencies: string[]; architectureRules: string[]; }
export interface ConstructionContext { plan: ArchitecturePlan; stage: ConstructionStage; attempt: number; artifacts: Record<string, unknown>; issues: string[]; }
export interface ConstructionResult { ok: boolean; status: "BUILT" | "REPAIRED" | "BLOCKED"; stage: ConstructionStage; attempts: number; selectedTool: string; issues: string[]; trace: ConstructionStage[]; details: string; idempotent?: boolean; }
export interface ConstructionTool { name: string; execute(stage: ConstructionStage, context: ConstructionContext): { ok: boolean; artifact?: unknown; issue?: string }; }

type Evidence = { testsPassed?: boolean; jestVerified?: boolean; behavioralEvidenceVerified?: boolean; integrationVerified?: boolean; cleanRepository?: boolean };

export class AutonomousConstructionEngine {
    constructor(private readonly tools: ConstructionTool[], private readonly maxRepairAttempts = 3, private readonly repairEngine = new AutonomousRepairEngine()) {}

    build(plan: ArchitecturePlan): ConstructionResult {
        const trace: ConstructionStage[] = [];
        const issues: string[] = [];
        const artifacts: Record<string, unknown> = {};
        if (!plan.capabilityId || !plan.capability || !plan.targetEngine) return this.blocked("ARCHITECTURE", 0, ["INVALID_ARCHITECTURE_PLAN"], trace);
        let attempt = 0;
        for (const stage of ["ARCHITECTURE", "PLAN", "GENERATE"] as ConstructionStage[]) {
            trace.push(stage);
            const result = this.execute(stage, plan, attempt, artifacts, issues);
            if (!result.ok) {
                if (stage === "GENERATE" && this.isIdempotentGenerationNoOp(result)) { artifacts[stage] = { ...(this.recordArtifact(result.artifact) ?? {}), idempotentNoOp: true }; continue; }
                issues.push(result.issue || `${stage}_FAILED`); return this.blocked(stage, attempt, issues, trace);
            }
            if (result.artifact !== undefined) artifacts[stage] = result.artifact;
        }
        trace.push("VERIFY");
        issues.length = 0;
        let verification = this.execute("VERIFY", plan, attempt, artifacts, issues);
        while (verification.ok && !this.hasRequiredEvidence(verification.artifact)) {
            verification = { ...verification, ok: false, issue: this.firstEvidenceIssue(verification.artifact) };
        }
        while (!verification.ok && attempt < this.maxRepairAttempts) {
            attempt += 1; trace.push("REPAIR");
            artifacts.REPAIR_PLAN = this.repairEngine.createPlan(verification.issue || "VERIFY_FAILED", JSON.stringify(verification));
            const repair = this.execute("REPAIR", plan, attempt, artifacts, issues);
            if (repair.artifact !== undefined) artifacts.REPAIR = repair.artifact;
            if (!repair.ok) { issues.push(repair.issue || "REPAIR_FAILED"); continue; }
            trace.push("VERIFY"); issues.length = 0; verification = this.execute("VERIFY", plan, attempt, artifacts, issues);
            if (verification.ok && !this.hasRequiredEvidence(verification.artifact)) verification = { ...verification, ok: false, issue: this.firstEvidenceIssue(verification.artifact) };
        }
        if (!verification.ok) { issues.push(verification.issue || "VERIFICATION_FAILED"); return this.blocked("VERIFY", attempt, issues, trace); }
        trace.push("FINALIZE");
        const finalize = this.execute("FINALIZE", plan, attempt, artifacts, issues);
        if (!finalize.ok) {
            if (this.isIdempotentFinalizeNoOp(finalize, artifacts)) artifacts.FINALIZE = { ...(this.recordArtifact(finalize.artifact) ?? {}), idempotentNoOp: true };
            else { issues.push(finalize.issue || "FINALIZE_FAILED"); return this.blocked("FINALIZE", attempt, issues, trace); }
        } else if (finalize.artifact !== undefined) artifacts.FINALIZE = finalize.artifact;
        return this.success(attempt > 0 ? "REPAIRED" : "BUILT", attempt, trace, this.recordArtifact(artifacts.GENERATE)?.idempotentNoOp === true);
    }

    private hasRequiredEvidence(value: unknown): boolean {
        const e = this.recordArtifact(value) as Evidence | null;
        return Boolean(e && e.testsPassed === true && (e.jestVerified === undefined || e.jestVerified === true) && e.behavioralEvidenceVerified === true && e.integrationVerified === true && e.cleanRepository === true);
    }
    private firstEvidenceIssue(value: unknown): string {
        const e = this.recordArtifact(value) as Evidence | null;
        if (!e || e.behavioralEvidenceVerified !== true) return "QUALITY_BEHAVIOR_UNVERIFIED";
        if (e.integrationVerified !== true) return "QUALITY_INTEGRATION_UNVERIFIED";
        if (e.testsPassed !== true) return "QUALITY_TESTS_UNVERIFIED";
        if (e.cleanRepository !== true) return "QUALITY_REPOSITORY_UNCLEAN";
        return "QUALITY_IMPLEMENTATION_UNVERIFIED";
    }
    private isIdempotentGenerationNoOp(result: { ok: boolean; artifact?: unknown; issue?: string }): boolean { if (result.ok || result.issue !== "AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE") return false; const a = this.recordArtifact(result.artifact); return Boolean(a && a.changed === false && a.exitCode === 0 && typeof a.output === "string" && /Already implemented:/i.test(a.output)); }
    private isIdempotentFinalizeNoOp(result: { ok: boolean; artifact?: unknown; issue?: string }, artifacts: Record<string, unknown>): boolean { if (result.ok || result.issue !== "GIT_NO_REPOSITORY_CHANGE") return false; return this.recordArtifact(artifacts.GENERATE)?.idempotentNoOp === true; }
    private recordArtifact(value: unknown): Record<string, any> | null { return value !== null && typeof value === "object" ? value as Record<string, any> : null; }
    private execute(stage: ConstructionStage, plan: ArchitecturePlan, attempt: number, artifacts: Record<string, unknown>, issues: string[]) { return this.toolFor(stage).execute(stage, { plan, stage, attempt, artifacts, issues }); }
    private toolFor(stage: ConstructionStage): ConstructionTool { const preferred: Record<ConstructionStage,string[]> = { ARCHITECTURE:["architecture"], PLAN:["architecture","planner"], GENERATE:["generator","python"], VERIFY:["python","verifier","test"], REPAIR:["python","repair"], FINALIZE:["git","finalizer"] }; for (const name of preferred[stage]) { const tool=this.tools.find(c=>c.name===name); if(tool)return tool; } return this.tools[0] || {name:"unavailable",execute:()=>({ok:false,issue:"NO_CONSTRUCTION_TOOL"})}; }
    private success(status:"BUILT"|"REPAIRED", attempts:number, trace:ConstructionStage[], idempotent=false):ConstructionResult{return {ok:true,status,stage:"FINALIZE",attempts,selectedTool:this.toolFor("FINALIZE").name,issues:[],trace,details:idempotent?`Construction verified as idempotent and finalized; trace=${trace.join(" -> ")}`:`Construction verified and finalized; trace=${trace.join(" -> ")}`,idempotent};}
    private blocked(stage:ConstructionStage,attempts:number,issues:string[],trace:ConstructionStage[]):ConstructionResult{return {ok:false,status:"BLOCKED",stage,attempts,selectedTool:this.toolFor(stage).name,issues,trace,details:`Construction blocked at ${stage}; trace=${trace.join(" -> ")}`};}
    static selfTest():void{let calls=0;const tools:ConstructionTool[]=[{name:"architecture",execute:()=>({ok:true})},{name:"python",execute:s=>s==="VERIFY"?(++calls===1?{ok:false,issue:"INTERNAL_CONNECTION_FAILURE"}:{ok:true,artifact:{testsPassed:true,behavioralEvidenceVerified:true,integrationVerified:true,cleanRepository:true}}):{ok:true}},{name:"git",execute:()=>({ok:true})}];const r=new AutonomousConstructionEngine(tools,2).build({capabilityId:"construction-001",capability:"architecture-driven autonomous construction",targetEngine:"Autonomous Operations Engine",dependencies:[],architectureRules:["Architecture Freeze V4"]});if(!r.ok||r.status!=="REPAIRED"||r.attempts!==1)throw new Error("AutonomousConstructionEngine self-test failed");}
}
