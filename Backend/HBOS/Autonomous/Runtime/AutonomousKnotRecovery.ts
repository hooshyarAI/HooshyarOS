import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface KnotCheckpoint {
    capabilityId: string;
    commit: string;
}

export interface KnotExecutionObservation {
    capabilityId: string;
    executionOk: boolean;
    verificationComplete: boolean;
    repositoryChanged: boolean;
}

export interface KnotRecoveryDecision {
    recover: boolean;
    action: "REPAIR" | "ADVANCE";
    checkpoint: KnotCheckpoint;
    rationale: string;
    repairCapabilityId?: string;
    stopConditions: string[];
}

/**
 * Decides whether the current knot is safe to advance or must be re-woven.
 *
 * A knot is never considered correct merely because generation succeeded.
 * Execution, verification and repository evidence must all agree before the
 * next canonical knot is allowed to start.
 */
export class AutonomousKnotRecovery {
    observe(checkpoint: KnotCheckpoint, observation: KnotExecutionObservation): KnotRecoveryDecision {
        if (observation.executionOk && observation.verificationComplete && observation.repositoryChanged) {
            return {
                recover: false,
                action: "ADVANCE",
                checkpoint,
                rationale: "knot execution, verification and repository evidence agree; advance to the next knot",
                stopConditions: [
                    "new verification failure",
                    "checkpoint evidence becomes inconsistent",
                    "unexpected capability owner appears"
                ]
            };
        }

        return {
            recover: true,
            action: "REPAIR",
            checkpoint,
            rationale: "current knot is not trusted; return to the last verified checkpoint and re-weave this knot before continuing",
            repairCapabilityId: `repair-${checkpoint.capabilityId}`,
            stopConditions: [
                "repair verification fails",
                "checkpoint cannot be established",
                "repository remains inconsistent after repair",
                "repair would cross an architecture ownership boundary"
            ]
        };
    }

    rollback(root: string, checkpoint: KnotCheckpoint): void {
        if (!checkpoint.commit) throw new Error("Cannot rollback without a verified checkpoint commit");

        const head = execFileSync("git", ["rev-parse", "HEAD"], {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        }).trim();

        const status = () => execFileSync(
            "git",
            ["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ":(exclude)node_modules"],
            {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"]
            }
        ).trim();

        const beforeStatus = status();

        if (head === checkpoint.commit && !beforeStatus) return;

        execFileSync("git", ["reset", "--hard", checkpoint.commit], {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        });

        const roadmapPath = join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json");
        const canonicalGenerated = new Set<string>();

        if (existsSync(roadmapPath)) {
            try {
                const roadmap = JSON.parse(readFileSync(roadmapPath, "utf8")) as {
                    capabilities?: Array<{
                        implementationPath?: string;
                        testPath?: string;
                        documentationPath?: string;
                    }>;
                };
                for (const capability of roadmap.capabilities ?? []) {
                    for (const relativePath of [
                        capability.implementationPath,
                        capability.testPath,
                        capability.documentationPath
                    ]) {
                        if (relativePath) canonicalGenerated.add(relativePath.replace(/\\/g, "/"));
                    }
                }
            } catch {
                // Without the roadmap we must remain fail-closed.
            }
        }

        const postRollbackStatus = status();
        if (!postRollbackStatus) return;

        const unexpected = postRollbackStatus
            .split(/\r?\n/)
            .filter(Boolean)
            .filter(line => {
                const path = line.slice(3).replace(/\\/g, "/");
                const untracked = line.startsWith("?? ");
                return !(untracked && canonicalGenerated.has(path));
            });

        if (unexpected.length > 0) {
            throw new Error(
                `Checkpoint rollback did not restore a trusted worktree for ${checkpoint.commit}: ${unexpected.join("; ")}`
            );
        }
    }
}
