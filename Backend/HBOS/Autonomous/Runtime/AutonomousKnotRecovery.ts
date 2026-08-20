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

        const canonicalCapabilityId = checkpoint.capabilityId.startsWith("repair-")
            ? checkpoint.capabilityId.slice("repair-".length)
            : checkpoint.capabilityId;

        return {
            recover: true,
            action: "REPAIR",
            checkpoint,
            rationale: "current knot is not trusted; return to the last verified checkpoint and re-weave this knot before continuing",
            repairCapabilityId: `repair-${canonicalCapabilityId}`,
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

        const beforeStatus = execFileSync(
            "git",
            ["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ":(exclude)node_modules"],
            {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"]
            }
        ).trim();

        if (head === checkpoint.commit && !beforeStatus) {
            return;
        }

        execFileSync("git", ["reset", "--hard", checkpoint.commit], {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        });

        const canonicalId = checkpoint.capabilityId.startsWith("repair-")
            ? checkpoint.capabilityId.slice("repair-".length)
            : checkpoint.capabilityId;

        const roadmapPath = join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json");

        if (existsSync(roadmapPath)) {
            try {
                const roadmap = JSON.parse(readFileSync(roadmapPath, "utf8")) as {
                    capabilities?: Array<{
                        capabilityId?: string;
                        implementationPath?: string;
                        testPath?: string;
                        documentationPath?: string;
                    }>;
                };

                const capability = roadmap.capabilities?.find(
                    item => item.capabilityId === canonicalId
                );

                const ownedPaths = [
                    capability?.implementationPath,
                    capability?.testPath,
                    capability?.documentationPath
                ].filter(Boolean) as string[];

                for (const relativePath of ownedPaths) {
                    execFileSync("git", ["clean", "-fd", "--", relativePath], {
                        cwd: root,
                        encoding: "utf8",
                        stdio: ["ignore", "pipe", "pipe"]
                    });
                }
            } catch {
                // Rollback remains safe even when the product roadmap is unavailable.
            }
        }

        const status = execFileSync(
            "git",
            ["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ":(exclude)node_modules"],
            {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"]
            }
        ).trim();

        if (status) {
            throw new Error(
                `Checkpoint rollback did not restore a clean worktree for ${checkpoint.commit}: ${status}`
            );
        }
    }
}
