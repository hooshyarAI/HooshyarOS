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
}

/**
 * Converts the existing repository state into the next autonomous construction mission.
 * It never replaces Architecture Freeze V4; it only derives executable work from it.
 */
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
            engineCount: this.countDirectories(join(this.root, "Backend", "HBOS", "Engine")),
            runtimeFileCount: existsSync(runtimeRoot) ? this.walk(runtimeRoot).length : 0,
            latestCommits: git(["log", "--oneline", "-12"]).split(/\r?\n/).filter(Boolean)
        };
    }

    nextMission(): Mission {
        const evidence = this.snapshot();
        const architectureText = this.readArchitectureEvidence();
        const hasAutonomousBuilder = architectureText.includes("AutonomousBuilderLoop");
        const hasSelfHealing = architectureText.includes("SelfReviewAgent") || architectureText.includes("AutoFixEngine");

        let capability = "continue architecture-driven autonomous construction";
        if (!hasAutonomousBuilder) capability = "activate architecture-driven autonomous builder";
        else if (!hasSelfHealing) capability = "activate autonomous self-healing and verification";
        else if (!evidence.clean) capability = "repair and verify the current working tree";

        return {
            capabilityId: `auto-${evidence.commit || "workspace"}`,
            capability,
            targetEngine: "Autonomous Operations Engine",
            evidence,
            directives: [
                "Read the final architecture and existing implementation before changing code",
                "Reuse existing capabilities; do not create duplicate engines",
                "Generate, verify, repair and re-verify autonomously",
                "Preserve Architecture Freeze V4 unless an explicit architecture defect is proven",
                "Keep the repository buildable after every completed capability"
            ]
        };
    }

    private readArchitectureEvidence(): string {
        const candidates = [
            join(this.root, "Assistant", "SYSTEM_PROMPT.md"),
            join(this.root, "ARCHITECTURE.md"),
            join(this.root, "README.md")
        ];
        return candidates
            .filter(existsSync)
            .map(file => readFileSync(file, "utf8"))
            .join("\n");
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
    console.log(JSON.stringify(new AutonomousProjectMission().nextMission(), null, 2));
}
