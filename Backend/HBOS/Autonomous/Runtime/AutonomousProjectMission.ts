import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CapabilityEvidenceAudit } from "./CapabilityEvidenceAudit";

export interface ProjectSnapshot { root: string; commit: string; clean: boolean; architectureFiles: string[]; engineCount: number; runtimeFileCount: number; latestCommits: string[]; }
export interface Mission { capabilityId: string; capability: string; targetEngine: string; evidence: ProjectSnapshot; directives: string[]; dependencies: string[]; architectureRules: string[]; }
interface CapabilityDefinition { id: string; capability: string; targetEngine: string; dependencies: string[]; requiredPaths: string[]; evidencePaths?: string[]; verificationPaths?: string[]; }

export class AutonomousProjectMission {
    private readonly evidenceAudit = new CapabilityEvidenceAudit();
    constructor(private readonly root = process.cwd()) {}

    snapshot(): ProjectSnapshot {
        const git = (args: string[]) => { try { return execFileSync("git", args, { cwd: this.root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
        const architectureRoot = join(this.root, "Backend", "HBOS", "Architecture");
        const runtimeRoot = join(this.root, "Backend", "AI_Runtime");
        const architectureFiles = existsSync(architectureRoot) ? this.walk(architectureRoot).filter(file => /Architecture|Decision|Planner|Registry|Review|Repair/i.test(file)) : [];
        return { root: this.root, commit: git(["rev-parse", "--short", "HEAD"]), clean: git(["status", "--porcelain", "--", ".", ":(exclude)node_modules"]) === "", architectureFiles, engineCount: this.countDirectories(join(this.root, "Backend", "HBOS", "Engines")), runtimeFileCount: existsSync(runtimeRoot) ? this.walk(runtimeRoot).length : 0, latestCommits: git(["log", "--oneline", "-12"]).split(/\r?\n/).filter(Boolean) };
    }

    nextMission(): Mission {
        const evidence = this.snapshot();
        if (!this.assistantCompletionEvidence()) {
            const assistantNext = this.nextAssistantCapability();
            if (assistantNext) return { ...assistantNext, evidence, architectureRules: this.architectureRules(), directives: this.directives() };
            if (!evidence.clean) return { capabilityId: `repair-${evidence.commit || "workspace"}`, capability: "repair and verify the current working tree", targetEngine: "Autonomous Operations Engine", evidence, dependencies: [], architectureRules: this.architectureRules(), directives: this.directives() };
            return { capabilityId: "assistant.completion.evidence", capability: "complete missing Assistant evidence required by the completion gate", targetEngine: "Autonomous Operations Engine", evidence, dependencies: ["Assistant Runtime", "Mission Controller", "Python Reasoning Adapter"], architectureRules: this.architectureRules(), directives: [...this.directives(), "The completion gate must be evidence-based.", "Verify required implementation, focused tests, local builder and runtime are present.", "Use only Python + GitHub + repository-native construction."] };
        }
        return { capabilityId: "assistant.completion.gate", capability: "HooshyarOS Autonomous Assistant completion gate", targetEngine: "Autonomous Operations Engine", evidence, dependencies: [], architectureRules: this.architectureRules(), directives: [...this.directives(), "All current canonical Assistant construction capabilities are present and the repository is clean.", "The autonomous construction path is repository-native and Python-backed.", "Do not start broad platform construction from this completion gate."] };
    }

    nextPlatformMission(): Omit<Mission, "evidence" | "architectureRules" | "directives"> | null {
        const next = this.capabilityBacklog().find(capability => !this.isCapabilityImplemented(capability) && this.dependenciesSatisfied(capability));
        return next ? { capabilityId: next.id, capability: next.capability, targetEngine: next.targetEngine, dependencies: next.dependencies } : null;
    }

    private dependenciesSatisfied(capability: CapabilityDefinition): boolean {
        return capability.dependencies.every(dependency => {
            const dep = this.capabilityBacklog().find(candidate => candidate.targetEngine === dependency || candidate.id === dependency);
            return !dep || this.isCapabilityImplemented(dep);
        });
    }

    private nextAssistantCapability(): Omit<Mission, "evidence" | "architectureRules" | "directives"> | null {
        const requiredPaths = [
            "Backend/HBOS/Assistant/Autonomous/AutonomousAssistantRuntime.ts","Backend/HBOS/Assistant/Autonomous/AutonomousMissionController.ts","Backend/HBOS/Assistant/Autonomous/HooshyarAutonomousAssistant.ts","Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts","Backend/HBOS/Assistant/Autonomous/PersistentArchitectureMemory.ts","Backend/HBOS/Assistant/Autonomous/DecisionKnowledgeStore.ts","Backend/HBOS/Assistant/Autonomous/ContextRetrievalEngine.ts","Backend/HBOS/Assistant/Autonomous/LearningFeedbackLoop.ts","Backend/HBOS/Autonomous/AutonomousProjectConductor.ts","Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts","Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts","Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts","Backend/HBOS/Builder/Autonomous/ArchitectureDrivenBuildController.ts","Backend/HBOS/Builder/Autonomous/AutonomousConstructionEngine.ts","Backend/AI_Runtime/autonomous_builder.py","Backend/AI_Runtime/reasoning/reasoning_engine.py","AGENTS.md","Assistant/SYSTEM_PROMPT.md"
        ].map(path => join(this.root, path));
        const missing = requiredPaths.find(path => !existsSync(path));
        return missing ? { capabilityId: "assistant.completion.evidence", capability: `complete missing Assistant evidence artifact: ${missing.replace(this.root, "").replace(/^[/\\]+/, "")}`, targetEngine: "Autonomous Operations Engine", dependencies: ["Assistant Runtime", "Mission Controller", "Python Reasoning Adapter"] } : null;
    }

    private capabilityBacklog(): CapabilityDefinition[] {
        const p = (path: string) => join(this.root, path);
        const focused = (path: string) => [p(path)];
        return [
            { id: "platform.user-management", capability: "implement the Phase 2 User Management capability", targetEngine: "User Management Engine", dependencies: ["HBOS Core", "Governance Engine"], requiredPaths: [p("Backend/HBOS/Engines/UserManagementEngine.ts"),p("Backend/HBOS/test/UserManagementEngine.test.ts"),p("Docs/Engines/UserManagementEngine.md")], verificationPaths: focused("Backend/HBOS/test/UserManagementEngine.test.ts") },
            { id: "platform.organization-model", capability: "implement the Phase 2 Organization Model capability", targetEngine: "Organization Model Engine", dependencies: ["HBOS Core", "User Management Engine"], requiredPaths: [p("Backend/HBOS/Engines/OrganizationModelEngine.ts"),p("Backend/HBOS/test/OrganizationModelEngine.test.ts"),p("Docs/Engines/OrganizationModelEngine.md")], verificationPaths: focused("Backend/HBOS/test/OrganizationModelEngine.test.ts") },
            { id: "platform.security-layer", capability: "implement the canonical Security Layer capability", targetEngine: "Security Layer Engine", dependencies: ["Governance Engine", "User Management Engine", "Organization Model Engine"], requiredPaths: [p("Backend/HBOS/Engines/SecurityLayerEngine.ts"),p("Backend/HBOS/test/SecurityLayerEngine.test.ts"),p("Docs/Engines/SecurityLayerEngine.md")], verificationPaths: focused("Backend/HBOS/test/SecurityLayerEngine.test.ts") },
            { id: "platform.api-gateway", capability: "implement the Phase 2 API Gateway capability", targetEngine: "API Gateway Engine", dependencies: ["Security Layer Engine"], requiredPaths: [p("Backend/HBOS/Engines/APIGatewayEngine.ts"),p("Backend/HBOS/test/APIGatewayEngine.test.ts"),p("Docs/Engines/APIGatewayEngine.md")], verificationPaths: focused("Backend/HBOS/test/APIGatewayEngine.test.ts") },
            { id: "engine.reasoning.canonical", capability: "implement the canonical Reasoning Engine for HBOS", targetEngine: "Reasoning Engine", dependencies: ["Memory Engine", "Knowledge Engine", "Decision Engine"], requiredPaths: [p("Backend/HBOS/Engines/ReasoningEngine.ts"),p("Backend/HBOS/test/ReasoningEngine.test.ts")], evidencePaths: [p("Backend/AI_Runtime/reasoning/reasoning_engine.py")], verificationPaths: focused("Backend/HBOS/test/ReasoningEngine.test.ts") },
            { id: "engine.organizational.canonical", capability: "implement the canonical Organizational Intelligence Engine for HBOS", targetEngine: "Organizational Intelligence Engine", dependencies: ["Memory Engine", "Knowledge Engine", "Project Pilot Engine"], requiredPaths: [p("Backend/HBOS/Engines/OrganizationalIntelligenceEngine.ts"),p("Backend/HBOS/test/OrganizationalIntelligenceEngine.test.ts")], verificationPaths: focused("Backend/HBOS/test/OrganizationalIntelligenceEngine.test.ts") },
            { id: "engine.autonomous-operations.canonical", capability: "implement the canonical Autonomous Operations Engine for HBOS", targetEngine: "Autonomous Operations Engine", dependencies: ["Governance Engine", "Decision Engine", "Project Pilot Engine", "Health Monitor Engine"], requiredPaths: [p("Backend/HBOS/Engines/AutonomousOperationsEngine.ts"),p("Backend/HBOS/test/AutonomousOperationsEngine.test.ts")], verificationPaths: focused("Backend/HBOS/test/AutonomousOperationsEngine.test.ts") },
            { id: "runtime.reasoning.bridge", capability: "integrate the existing Python reasoning runtime with the canonical HBOS Reasoning Engine", targetEngine: "ReasoningEngine", dependencies: ["Reasoning Engine", "AI Runtime"], requiredPaths: [p("Backend/HBOS/Engines/ReasoningEngine.ts"),p("Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts"),p("Backend/HBOS/test/PythonReasoningAdapter.test.ts")], evidencePaths: [p("Backend/AI_Runtime/reasoning/reasoning_engine.py")], verificationPaths: focused("Backend/HBOS/test/PythonReasoningAdapter.test.ts") },
            { id: "platform.financial-intelligence", capability: "implement the canonical Financial Intelligence capability", targetEngine: "Financial Intelligence Engine", dependencies: ["Reasoning Engine", "Governance Engine"], requiredPaths: [p("Backend/HBOS/Engines/FinancialIntelligenceEngine.ts"),p("Backend/HBOS/test/FinancialIntelligenceEngine.test.ts"),p("Docs/Engines/FinancialIntelligenceEngine.md")], verificationPaths: focused("Backend/HBOS/test/FinancialIntelligenceEngine.test.ts") },
            { id: "platform.budget-intelligence", capability: "implement Budget Intelligence", targetEngine: "Budget Intelligence Engine", dependencies: ["Financial Intelligence Engine"], requiredPaths: [p("Backend/HBOS/Engines/BudgetIntelligenceEngine.ts"),p("Backend/HBOS/test/BudgetIntelligenceEngine.test.ts"),p("Docs/Engines/BudgetIntelligenceEngine.md")], verificationPaths: focused("Backend/HBOS/test/BudgetIntelligenceEngine.test.ts") },
            { id: "platform.tax-intelligence", capability: "implement Tax Intelligence", targetEngine: "Tax Intelligence Engine", dependencies: ["Financial Intelligence Engine"], requiredPaths: [p("Backend/HBOS/Engines/TaxIntelligenceEngine.ts"),p("Backend/HBOS/test/TaxIntelligenceEngine.test.ts"),p("Docs/Engines/TaxIntelligenceEngine.md")], verificationPaths: focused("Backend/HBOS/test/TaxIntelligenceEngine.test.ts") },
            { id: "platform.dashboard", capability: "implement Dashboard capability", targetEngine: "Dashboard Engine", dependencies: ["Executive Intelligence Engine"], requiredPaths: [p("Backend/HBOS/Engines/DashboardEngine.ts"),p("Backend/HBOS/test/DashboardEngine.test.ts"),p("Docs/Engines/DashboardEngine.md")], verificationPaths: focused("Backend/HBOS/test/DashboardEngine.test.ts") },
            { id: "platform.reports", capability: "implement Reports capability", targetEngine: "Reports Engine", dependencies: ["Dashboard Engine"], requiredPaths: [p("Backend/HBOS/Engines/ReportsEngine.ts"),p("Backend/HBOS/test/ReportsEngine.test.ts"),p("Docs/Engines/ReportsEngine.md")], verificationPaths: focused("Backend/HBOS/test/ReportsEngine.test.ts") },
            { id: "platform.alerts", capability: "implement Alerts capability", targetEngine: "Alerts Engine", dependencies: ["Dashboard Engine"], requiredPaths: [p("Backend/HBOS/Engines/AlertsEngine.ts"),p("Backend/HBOS/test/AlertsEngine.test.ts"),p("Docs/Engines/AlertsEngine.md")], verificationPaths: focused("Backend/HBOS/test/AlertsEngine.test.ts") },
            { id: "platform.production-readiness", capability: "implement repository-native Production Readiness capability", targetEngine: "Production Readiness Engine", dependencies: ["Autonomous Operations Engine", "Security Layer Engine"], requiredPaths: [p("Backend/HBOS/Engines/ProductionReadinessEngine.ts"),p("Backend/HBOS/test/ProductionReadinessEngine.test.ts"),p("Docs/Engines/ProductionReadinessEngine.md")], verificationPaths: focused("Backend/HBOS/test/ProductionReadinessEngine.test.ts") },
            { id: "platform.security-audit", capability: "implement repository-native Security Audit capability", targetEngine: "Security Audit Engine", dependencies: ["Production Readiness Engine", "Security Layer Engine"], requiredPaths: [p("Backend/HBOS/Engines/SecurityAuditEngine.ts"),p("Backend/HBOS/test/SecurityAuditEngine.test.ts"),p("Docs/Engines/SecurityAuditEngine.md")], verificationPaths: focused("Backend/HBOS/test/SecurityAuditEngine.test.ts") },
            { id: "platform.performance-testing", capability: "implement repository-native Performance Testing capability", targetEngine: "Performance Testing Engine", dependencies: ["Production Readiness Engine"], requiredPaths: [p("Backend/HBOS/Engines/PerformanceTestingEngine.ts"),p("Backend/HBOS/test/PerformanceTestingEngine.test.ts"),p("Docs/Engines/PerformanceTestingEngine.md")], verificationPaths: focused("Backend/HBOS/test/PerformanceTestingEngine.test.ts") },
            { id: "platform.customer-testing", capability: "implement repository-native Customer Testing capability", targetEngine: "Customer Testing Engine", dependencies: ["Production Readiness Engine", "Performance Testing Engine"], requiredPaths: [p("Backend/HBOS/Engines/CustomerTestingEngine.ts"),p("Backend/HBOS/test/CustomerTestingEngine.test.ts"),p("Docs/Engines/CustomerTestingEngine.md")], verificationPaths: focused("Backend/HBOS/test/CustomerTestingEngine.test.ts") },
            { id: "platform.deployment-readiness", capability: "implement repository-native Deployment Readiness capability", targetEngine: "Deployment Readiness Engine", dependencies: ["Production Readiness Engine", "Security Audit Engine", "Performance Testing Engine", "Customer Testing Engine"], requiredPaths: [p("Backend/HBOS/Engines/DeploymentReadinessEngine.ts"),p("Backend/HBOS/test/DeploymentReadinessEngine.test.ts"),p("Docs/Engines/DeploymentReadinessEngine.md")], verificationPaths: focused("Backend/HBOS/test/DeploymentReadinessEngine.test.ts") },
            { id: "platform.deployment-contract", capability: "implement repository-native Deployment Contract capability", targetEngine: "Deployment Contract Engine", dependencies: ["Deployment Readiness Engine"], requiredPaths: [p("Backend/HBOS/Engines/DeploymentContractEngine.ts"),p("Backend/HBOS/test/DeploymentContractEngine.test.ts"),p("Docs/Engines/DeploymentContractEngine.md")], verificationPaths: focused("Backend/HBOS/test/DeploymentContractEngine.test.ts") },
            { id: "platform.cloud-deployment", capability: "implement repository-native Cloud Deployment capability", targetEngine: "Cloud Deployment Engine", dependencies: ["Deployment Contract Engine"], requiredPaths: [p("Backend/HBOS/Engines/CloudDeploymentEngine.ts"),p("Backend/HBOS/test/CloudDeploymentEngine.test.ts"),p("Docs/Engines/CloudDeploymentEngine.md")], verificationPaths: focused("Backend/HBOS/test/CloudDeploymentEngine.test.ts") }
        ];
    }

    private isCapabilityImplemented(capability: CapabilityDefinition): boolean {
        const implementation = capability.requiredPaths.length > 0 && existsSync(capability.requiredPaths[0]);
        const test = capability.verificationPaths?.every(existsSync) ?? false;
        const documentationPaths = capability.requiredPaths.filter(path => /Docs[\\/]/.test(path));
        const documentation = documentationPaths.length === 0 || documentationPaths.every(existsSync);
        const supportingEvidence = !capability.evidencePaths || capability.evidencePaths.some(existsSync);
        const verification = capability.verificationPaths?.every(existsSync) ?? false;
        const dependenciesSatisfied = capability.dependencies.every(dependency => {
            const dep = this.capabilityBacklog().find(candidate => candidate.targetEngine === dependency || candidate.id === dependency);
            return !dep || this.isCapabilityImplemented(dep);
        });
        return this.evidenceAudit.evaluate({ implementation, test, documentation, dependenciesSatisfied: dependenciesSatisfied && supportingEvidence, verified: verification }).complete;
    }

    private assistantCompletionEvidence(): boolean {
        const required = [
            "Backend/HBOS/Assistant/Autonomous/AutonomousAssistantRuntime.ts","Backend/HBOS/Assistant/Autonomous/AutonomousMissionController.ts","Backend/HBOS/Assistant/Autonomous/HooshyarAutonomousAssistant.ts","Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts","Backend/HBOS/Assistant/Autonomous/PersistentArchitectureMemory.ts","Backend/HBOS/Assistant/Autonomous/DecisionKnowledgeStore.ts","Backend/HBOS/Assistant/Autonomous/ContextRetrievalEngine.ts","Backend/HBOS/Assistant/Autonomous/LearningFeedbackLoop.ts","Backend/HBOS/Autonomous/AutonomousProjectConductor.ts","Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts","Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts","Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts","Backend/HBOS/Builder/Autonomous/ArchitectureDrivenBuildController.ts","Backend/HBOS/Builder/Autonomous/AutonomousConstructionEngine.ts","Backend/HBOS/test/AutonomousMissionController.test.ts","Backend/HBOS/test/AutonomousAssistantRuntime.test.ts","Backend/HBOS/test/HooshyarAutonomousAssistant.test.ts","Backend/HBOS/test/PythonReasoningAdapter.test.ts","Backend/AI_Runtime/autonomous_builder.py","Backend/AI_Runtime/reasoning/reasoning_engine.py","AGENTS.md","Assistant/SYSTEM_PROMPT.md"
        ].map(path => join(this.root, path));
        if (!required.every(existsSync)) return false;
        const runtime = readFileSync(join(this.root, "Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts"), "utf8");
        const loop = readFileSync(join(this.root, "Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts"), "utf8");
        const controller = readFileSync(join(this.root, "Backend/HBOS/Builder/Autonomous/ArchitectureDrivenBuildController.ts"), "utf8");
        const conductor = readFileSync(join(this.root, "Backend/HBOS/Autonomous/AutonomousProjectConductor.ts"), "utf8");
        const daemon = readFileSync(join(this.root, "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts"), "utf8");
        const builder = readFileSync(join(this.root, "Backend/AI_Runtime/autonomous_builder.py"), "utf8");
        const reasoning = readFileSync(join(this.root, "Backend/AI_Runtime/reasoning/reasoning_engine.py"), "utf8");
        const constitution = readFileSync(join(this.root, "Assistant/SYSTEM_PROMPT.md"), "utf8");
        const pythonOnly = runtime.includes("ImplementationAgent") && runtime.includes('"python"') && runtime.includes("GENERATE") && runtime.includes("VERIFY") && runtime.includes("REPAIR") && runtime.includes("FINALIZE");
        const lifecycle = ["GENERATE", "VERIFY", "REPAIR", "FINALIZE"].every(stage => runtime.includes(stage));
        const orchestration = loop.includes("this.planner.plan(goal)") && loop.includes("controller.construct(plan.requirement)") && controller.includes("ARCHITECTURE") && controller.includes("PLAN");
        const autonomousHandoff = conductor.includes("autonomous-self-healing") && daemon.includes("platform-continuation") && daemon.includes("AUTONOMOUS_PLATFORM_BACKLOG_EXHAUSTED");
        const local = builder.includes("argparse") && builder.includes("CAPABILITIES") && builder.includes("Capability ID:") && builder.includes("if not generated:") && !builder.includes('subprocess.run(["copilot"') && !builder.includes('subprocess.run(["codex"') && !builder.includes('subprocess.run(["claude"');
        const supportedPlatformCapabilities = ["platform.user-management", "platform.organization-model", "platform.security-layer"].every(id => builder.includes(id));
        const reasoningContract = reasoning.includes("class ReasoningEngine") && reasoning.includes("def reason") && reasoning.includes('"status": "reasoned"');
        const constructionIdentity = /python/i.test(constitution) && /autonomous/i.test(constitution);
        return pythonOnly && lifecycle && orchestration && autonomousHandoff && local && supportedPlatformCapabilities && reasoningContract && constructionIdentity;
    }

    private architectureRules(): string[] { return ["Architecture Freeze V4","Five Main Intelligence Engines remain canonical","Everything is an Engine","One Capability = One Engine = One Test = One Commit","Reuse existing capabilities; do not create duplicate engines","Every completed engine requires identity, lifecycle, health monitoring, test coverage and documentation"]; }
    private directives(): string[] { return ["Read Docs/ARCHITECTURE.md and existing engine implementations before changing code","Read Assistant/SYSTEM_PROMPT.md as the development constitution","Inspect the existing AI Runtime before creating a new implementation","Implement exactly ONE concrete capability from the canonical backlog","Create or update the focused implementation, focused test and documentation required by the architecture","Run focused verification followed by the full Jest suite","Repair verification failures before finalization","Do not stop at a plan or report; produce a real repository change when the selected capability is missing","Do not redesign Architecture Freeze V4"]; }
    private walk(root: string): string[] { const out:string[]=[]; for(const entry of readdirSync(root,{withFileTypes:true})){const full=join(root,entry.name); if(entry.name==="__pycache__"||entry.name==="node_modules")continue; if(entry.isDirectory())out.push(...this.walk(full)); else out.push(full);} return out; }
    private countDirectories(root: string): number { if(!existsSync(root))return 0; return readdirSync(root,{withFileTypes:true}).filter(entry=>entry.isDirectory()).length; }
}
