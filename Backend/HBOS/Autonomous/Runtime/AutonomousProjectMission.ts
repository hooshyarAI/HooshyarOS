import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ProjectSnapshot {
    root: string;
    commit: string;
    clean: boolean;
    architectureFiles: string[];
    engineCount: number;
    runtimeFileCount: number;
    latestCommits: string[];
}

export interface Mission {
    capabilityId: string;
    capability: string;
    targetEngine: string;
    evidence: ProjectSnapshot;
    directives: string[];
    dependencies: string[];
    architectureRules: string[];
}

interface CapabilityDefinition {
    id: string;
    capability: string;
    targetEngine: string;
    dependencies: string[];
    requiredPaths: string[];
    evidencePaths?: string[];
}

export class AutonomousProjectMission {
    constructor(private readonly root = process.cwd()) {}

    snapshot(): ProjectSnapshot {
        const git = (args: string[]) => {
            try {
                return execFileSync("git", args, { cwd: this.root, encoding: "utf8" }).trim();
            } catch {
                return "";
            }
        };

        const architectureRoot = join(this.root, "Backend", "HBOS", "Architecture");
        const runtimeRoot = join(this.root, "Backend", "AI_Runtime");
        const architectureFiles = existsSync(architectureRoot)
            ? this.walk(architectureRoot).filter(file => /Architecture|Decision|Planner|Registry|Review|Repair/i.test(file))
            : [];

        return {
            root: this.root,
            commit: git(["rev-parse", "--short", "HEAD"]),
            clean: git(["status", "--porcelain"]) === "",
            architectureFiles,
            engineCount: this.countDirectories(join(this.root, "Backend", "HBOS", "Engines")),
            runtimeFileCount: existsSync(runtimeRoot) ? this.walk(runtimeRoot).length : 0,
            latestCommits: git(["log", "--oneline", "-12"]).split(/\r?\n/).filter(Boolean)
        };
    }

    nextMission(): Mission {
        const evidence = this.snapshot();

        // The Assistant must reach its own evidence-based completion gate before
        // the daemon is allowed to enter platform construction. This prevents a
        // platform backlog item from accidentally bypassing unfinished Assistant
        // capabilities.
        if (!this.assistantCompletionEvidence()) {
            const assistantNext = this.nextAssistantCapability();
            if (assistantNext) {
                return {
                    ...assistantNext,
                    evidence,
                    architectureRules: this.architectureRules(),
                    directives: this.directives()
                };
            }

            if (!evidence.clean) {
                return {
                    capabilityId: `repair-${evidence.commit || "workspace"}`,
                    capability: "repair and verify the current working tree",
                    targetEngine: "Autonomous Operations Engine",
                    evidence,
                    dependencies: [],
                    architectureRules: this.architectureRules(),
                    directives: this.directives()
                };
            }

            return {
                capabilityId: "assistant.completion.evidence",
                capability: "complete missing Assistant evidence required by the completion gate",
                targetEngine: "Autonomous Operations Engine",
                evidence,
                dependencies: ["Assistant Runtime", "Mission Controller", "Python Reasoning Adapter"],
                architectureRules: this.architectureRules(),
                directives: [
                    ...this.directives(),
                    "The completion gate must be evidence-based.",
                    "Verify required implementation, focused tests, local builder and runtime are present.",
                    "Reject obsolete cloud coding providers from the autonomous construction path."
                ]
            };
        }

        const next = this.nextPlatformMission();
        if (next) {
            return {
                ...next,
                evidence,
                architectureRules: this.architectureRules(),
                directives: this.directives()
            };
        }

        return {
            capabilityId: "assistant.completion.gate",
            capability: "HooshyarOS Autonomous Assistant completion gate",
            targetEngine: "Autonomous Operations Engine",
            evidence,
            dependencies: [],
            architectureRules: this.architectureRules(),
            directives: [
                ...this.directives(),
                "All current canonical Assistant construction capabilities are present and the repository is clean.",
                "The autonomous construction path is repository-native and Python-backed.",
                "Do not start broad platform construction from this completion gate."
            ]
        };
    }

    /** Selects the next real platform capability without manufacturing a placeholder mission. */
    nextPlatformMission(): Omit<Mission, "evidence" | "architectureRules" | "directives"> | null {
        const next = this.capabilityBacklog().find(capability => !this.isCapabilityImplemented(capability));
        if (!next) return null;

        return {
            capabilityId: next.id,
            capability: next.capability,
            targetEngine: next.targetEngine,
            dependencies: next.dependencies
        };
    }

    private nextAssistantCapability(): Omit<Mission, "evidence" | "architectureRules" | "directives"> | null {
        // Keep the Assistant completion contract deterministic: if a required
        // artifact is missing, the existing evidence mission repairs that gap;
        // otherwise return null so completion evidence can be evaluated.
        const requiredPaths = [
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "AutonomousAssistantRuntime.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "AutonomousMissionController.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "HooshyarAutonomousAssistant.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "PythonReasoningAdapter.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "PersistentArchitectureMemory.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "DecisionKnowledgeStore.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "ContextRetrievalEngine.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "LearningFeedbackLoop.ts"),
            join(this.root, "Backend", "Builder", "Autonomous", "AutonomousProjectConductor.ts"),
            join(this.root, "Backend", "HBOS", "Autonomous", "Runtime", "LocalConstructionToolset.ts"),
            join(this.root, "Backend", "HBOS", "Autonomous", "Runtime", "AutonomousBuildDaemon.ts")
        ];
        const missing = requiredPaths.find(path => !existsSync(path));
        if (!missing) return null;

        return {
            capabilityId: "assistant.completion.evidence",
            capability: `complete missing Assistant evidence artifact: ${missing.replace(this.root, "").replace(/^[/\\]+/, "")}`,
            targetEngine: "Autonomous Operations Engine",
            dependencies: ["Assistant Runtime", "Mission Controller", "Python Reasoning Adapter"]
        };
    }

    private capabilityBacklog(): CapabilityDefinition[] {
        return [
            {
                id: "engine.reasoning.canonical",
                capability: "implement the canonical Reasoning Engine for HBOS",
                targetEngine: "Reasoning Engine",
                dependencies: ["Memory Engine", "Knowledge Engine", "Decision Engine"],
                requiredPaths: [
                    join(this.root, "Backend", "HBOS", "Engines", "ReasoningEngine.ts"),
                    join(this.root, "Backend", "HBOS", "test", "ReasoningEngine.test.ts")
                ],
                evidencePaths: [join(this.root, "Backend", "AI_Runtime", "reasoning", "reasoning_engine.py")]
            },
            {
                id: "engine.organizational.canonical",
                capability: "implement the canonical Organizational Intelligence Engine for HBOS",
                targetEngine: "Organizational Intelligence Engine",
                dependencies: ["Memory Engine", "Knowledge Engine", "Project Pilot Engine"],
                requiredPaths: [
                    join(this.root, "Backend", "HBOS", "Engines", "OrganizationalIntelligenceEngine.ts"),
                    join(this.root, "Backend", "HBOS", "test", "OrganizationalIntelligenceEngine.test.ts")
                ]
            },
            {
                id: "engine.autonomous-operations.canonical",
                capability: "implement the canonical Autonomous Operations Engine for HBOS",
                targetEngine: "Autonomous Operations Engine",
                dependencies: ["Governance Engine", "Decision Engine", "Project Pilot Engine", "Health Monitor Engine"],
                requiredPaths: [
                    join(this.root, "Backend", "HBOS", "Engines", "AutonomousOperationsEngine.ts"),
                    join(this.root, "Backend", "HBOS", "test", "AutonomousOperationsEngine.test.ts")
                ]
            },
            {
                id: "runtime.reasoning.bridge",
                capability: "integrate the existing Python reasoning runtime with the canonical HBOS Reasoning Engine",
                targetEngine: "Reasoning Engine",
                dependencies: ["Reasoning Engine", "AI Runtime"],
                requiredPaths: [
                    join(this.root, "Backend", "HBOS", "Engines", "ReasoningEngine.ts"),
                    join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "PythonReasoningAdapter.ts"),
                    join(this.root, "Backend", "HBOS", "test", "PythonReasoningAdapter.test.ts")
                ],
                evidencePaths: [join(this.root, "Backend", "AI_Runtime", "reasoning", "reasoning_engine.py")]
            }
        ];
    }

    private isCapabilityImplemented(capability: CapabilityDefinition): boolean {
        const required = capability.requiredPaths.every(existsSync);
        if (!required) return false;
        if (!capability.evidencePaths || capability.evidencePaths.length === 0) return true;
        return capability.evidencePaths.some(existsSync);
    }

    private assistantCompletionEvidence(): boolean {
        const requiredPaths = [
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "AutonomousAssistantRuntime.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "AutonomousMissionController.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "HooshyarAutonomousAssistant.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "PythonReasoningAdapter.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "PersistentArchitectureMemory.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "DecisionKnowledgeStore.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "ContextRetrievalEngine.ts"),
            join(this.root, "Backend", "HBOS", "Assistant", "Autonomous", "LearningFeedbackLoop.ts"),
            join(this.root, "Backend", "Builder", "Autonomous", "AutonomousProjectConductor.ts"),
            join(this.root, "Backend", "HBOS", "Autonomous", "Runtime", "LocalConstructionToolset.ts"),
            join(this.root, "Backend", "HBOS", "Autonomous", "Runtime", "AutonomousBuildDaemon.ts"),
            join(this.root, "Backend", "HBOS", "test", "AutonomousMissionController.test.ts"),
            join(this.root, "Backend", "HBOS", "test", "AutonomousAssistantRuntime.test.ts"),
            join(this.root, "Backend", "HBOS", "test", "HooshyarAutonomousAssistant.test.ts"),
            join(this.root, "Backend", "HBOS", "test", "PythonReasoningAdapter.test.ts"),
            join(this.root, "Backend", "AI_Runtime", "autonomous_builder.py"),
            join(this.root, "Backend", "AI_Runtime", "reasoning", "reasoning_engine.py")
        ];
        if (!requiredPaths.every(existsSync)) return false;

        const autonomousRuntime = readFileSync(join(this.root, "Backend", "HBOS", "Autonomous", "Runtime", "LocalConstructionToolset.ts"), "utf8");
        const developmentLoop = readFileSync(join(this.root, "Backend", "HBOS", "Architecture", "Autonomous", "AutonomousDevelopmentLoop.ts"), "utf8");
        const controller = readFileSync(join(this.root, "Backend", "Builder", "Autonomous", "ArchitectureDrivenBuildController.ts"), "utf8");
        const builder = readFileSync(join(this.root, "Backend", "AI_Runtime", "autonomous_builder.py"), "utf8");
        const reasoningRuntime = readFileSync(join(this.root, "Backend", "AI_Runtime", "reasoning", "reasoning_engine.py"), "utf8");

        const pythonOnly = autonomousRuntime.includes('type ImplementationAgent = "python"')
            && autonomousRuntime.includes("Backend/AI_Runtime/autonomous_builder.py")
            && autonomousRuntime.includes("Do not invoke Copilot, Codex, Claude, or any cloud coding CLI.");
        const constructionLifecycle = ["GENERATE", "VERIFY", "REPAIR", "FINALIZE"].every(stage => autonomousRuntime.includes(stage));
        const orchestrationLifecycle = developmentLoop.includes("this.planner.plan(goal)")
            && developmentLoop.includes("controller.construct(plan.requirement)")
            && controller.includes("ARCHITECTURE")
            && controller.includes("PLAN");
        const localBuilderContract = builder.includes("argparse")
            && builder.includes("CAPABILITIES")
            && builder.includes("Capability ID:")
            && builder.includes("if not generated:")
            && !builder.includes("subprocess.run([\"copilot\"")
            && !builder.includes("subprocess.run([\"codex\"")
            && !builder.includes("subprocess.run([\"claude\"");
        const reasoningContract = reasoningRuntime.includes("class ReasoningEngine")
            && reasoningRuntime.includes("def reason")
            && reasoningRuntime.includes('"status": "reasoned"');

        return pythonOnly && constructionLifecycle && orchestrationLifecycle && localBuilderContract && reasoningContract;
    }

    private architectureRules(): string[] {
        return [
            "Architecture Freeze V4",
            "Five Main Intelligence Engines remain canonical",
            "Everything is an Engine",
            "One Capability = One Engine = One Test = One Commit",
            "Reuse existing capabilities; do not create duplicate engines",
            "Every completed engine requires identity, lifecycle, health monitoring, test coverage and documentation"
        ];
    }

    private directives(): string[] {
        return [
            "Read Docs/ARCHITECTURE.md and existing engine implementations before changing code",
            "Inspect the existing AI Runtime before creating a new implementation",
            "Implement exactly ONE concrete capability from the canonical backlog",
            "Create or update the focused implementation, focused test and documentation required by the architecture",
            "Run focused verification followed by the full Jest suite",
            "Repair verification failures before finalization",
            "Do not stop at a plan or report; produce a real repository change when the selected capability is missing",
            "Do not redesign Architecture Freeze V4"
        ];
    }

    private walk(root: string): string[] {
        const out: string[] = [];
        for (const entry of readdirSync(root, { withFileTypes: true })) {
            const full = join(root, entry.name);
            if (entry.name === "__pycache__" || entry.name === "node_modules") continue;
            if (entry.isDirectory()) out.push(...this.walk(full));
            else out.push(full);
        }
        return out;
    }

    private countDirectories(root: string): number {
        if (!existsSync(root)) return 0;
        return readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).length;
    }
}

if (require.main === module) {
    const mission = new AutonomousProjectMission();
    const next = mission.nextMission();
    console.log(JSON.stringify(next, null, 2));
}
