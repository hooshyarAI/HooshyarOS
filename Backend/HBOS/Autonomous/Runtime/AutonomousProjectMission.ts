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
        const backlog = this.capabilityBacklog();
        const next = backlog.find(capability => !this.isCapabilityImplemented(capability));

        if (next) {
            return {
                capabilityId: next.id,
                capability: next.capability,
                targetEngine: next.targetEngine,
                evidence,
                dependencies: next.dependencies,
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

        if (!this.assistantCompletionEvidence()) {
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
                    "Do not report Assistant completion until required implementation and focused tests are present."
                ]
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
                "Do not start broad platform construction from this completion gate."
            ]
        };
    }

    private capabilityBacklog(): CapabilityDefinition[] {
        return [
            {
                id: "engine.reasoning.canonical",
                capability: "implement the canonical Reasoning Engine for HBOS",
                targetEngine: "Reasoning Engine",
                dependencies: ["Memory Engine", "Knowledge Engine", "Decision Engine"],
                requiredPaths: [join(this.root, "Backend", "HBOS", "Engines", "ReasoningEngine.ts")],
                evidencePaths: [join(this.root, "Backend", "AI_Runtime", "reasoning", "reasoning_engine.py")]
            },
            {
                id: "engine.organizational.canonical",
                capability: "implement the canonical Organizational Intelligence Engine for HBOS",
                targetEngine: "Organizational Intelligence Engine",
                dependencies: ["Memory Engine", "Knowledge Engine", "Project Pilot Engine"],
                requiredPaths: [join(this.root, "Backend", "HBOS", "Engines", "OrganizationalIntelligenceEngine.ts")]
            },
            {
                id: "engine.autonomous-operations.canonical",
                capability: "implement the canonical Autonomous Operations Engine for HBOS",
                targetEngine: "Autonomous Operations Engine",
                dependencies: ["Governance Engine", "Decision Engine", "Project Pilot Engine", "Health Monitor Engine"],
                requiredPaths: [join(this.root, "Backend", "HBOS", "Engines", "AutonomousOperationsEngine.ts")]
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
            join(this.root, "Backend", "HBOS", "test", "PythonReasoningAdapter.test.ts")
        ];
        return requiredPaths.every(existsSync);
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

    private readArchitectureEvidence(): string {
        const candidates = [
            join(this.root, "Assistant", "SYSTEM_PROMPT.md"),
            join(this.root, "Docs", "ARCHITECTURE.md"),
            join(this.root, "ARCHITECTURE.md"),
            join(this.root, "README.md")
        ];
        return candidates.filter(existsSync).map(file => readFileSync(file, "utf8")).join("\n");
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
