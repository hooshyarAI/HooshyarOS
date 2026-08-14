import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AutonomousFailureAnalysisEngine, RepairCluster } from "./AutonomousFailureAnalysisEngine";
import { RepairStrategyKind, SelfRepairStrategyPlanner } from "../../Assistant/Autonomous/SelfRepairStrategyPlanner";

export interface KnotCheckpoint {
    capabilityId: string;
    commit: string;
}

export interface KnotExecutionObservation {
    capabilityId: string;
    executionOk: boolean;
    verificationComplete: boolean;
    repositoryChanged: boolean;
    failures?: string[];
}

export interface KnotRecoveryDecision {
    recover: boolean;
    action: "REPAIR" | "ADVANCE";
    checkpoint: KnotCheckpoint;
    rationale: string;
    repairCapabilityId?: string;
    repairCluster?: RepairCluster;
    repairEvidence?: string[];
    repairStrategy?: RepairStrategyKind;
    repairDepth?: string;
    repairVerification?: string[];
    stopConditions: string[];
}

function canonicalCapabilityId(capabilityId: string): string {
    let canonical = capabilityId;
    while (canonical.startsWith("repair-")) canonical = canonical.slice("repair-".length);
    return canonical;
}

export class AutonomousKnotRecovery {
    private readonly failureAnalysis = new AutonomousFailureAnalysisEngine();
    private readonly strategyPlanner = new SelfRepairStrategyPlanner();
    private readonly strategyHistory = new Map<string, RepairStrategyKind[]>();

    observe(checkpoint: KnotCheckpoint, observation: KnotExecutionObservation): KnotRecoveryDecision {
        if (observation.executionOk && observation.verificationComplete && observation.repositoryChanged) {
            this.resetStrategyHistory(checkpoint.capabilityId);
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

        const cluster = this.failureAnalysis.selectNext(observation.failures ?? []);
        const parentCapabilityId = canonicalCapabilityId(checkpoint.capabilityId);
        const previousStrategies = this.strategyHistory.get(parentCapabilityId) ?? [];
        const plan = this.strategyPlanner.plan(cluster, observation.failures ?? [], previousStrategies);
        this.strategyHistory.set(parentCapabilityId, [...previousStrategies, plan.strategy]);
        const repairCapabilityId = `repair-${parentCapabilityId}`;
        const clusterReason = cluster
            ? `root cause selected=${cluster.rootCause}; repair evidence must address that cluster before re-verification`
            : "no known root cause was classified, so the canonical knot repair remains the safe fallback";
        const enrichedCluster = cluster
            ? {
                ...cluster,
                rationale: `${cluster.rationale}; SELF_REPAIR_DEPTH=${plan.depth}; SELF_REPAIR_STRATEGY=${plan.strategy}; CONSTRAINTS=${plan.constraints.join(" | ")}`
            }
            : undefined;
        const repairEvidence = [
            ...(cluster?.evidence ?? observation.failures ?? []),
            `SELF_REPAIR_STRATEGY=${plan.strategy}`,
            `SELF_REPAIR_DEPTH=${plan.depth}`,
            ...plan.verification.map(item => `VERIFY=${item}`)
        ];

        return {
            recover: true,
            action: "REPAIR",
            checkpoint,
            rationale: `${clusterReason}; complexity=${plan.depth}; strategy=${plan.strategy}; ${plan.rationale}`,
            repairCapabilityId,
            repairCluster: enrichedCluster,
            repairEvidence,
            repairStrategy: plan.strategy,
            repairDepth: plan.depth,
            repairVerification: plan.verification,
            stopConditions: [
                "repair verification fails",
                "checkpoint cannot be established",
                "repository remains inconsistent after repair",
                "all distinct repair strategies are exhausted",
                "repair would cross an architecture ownership boundary"
            ]
        };
    }

    resetStrategyHistory(capabilityId: string): void {
        this.strategyHistory.delete(canonicalCapabilityId(capabilityId));
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
            { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        ).trim();

        if (head === checkpoint.commit && !beforeStatus) return;

        execFileSync("git", ["reset", "--hard", checkpoint.commit], {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        });

        const canonicalId = canonicalCapabilityId(checkpoint.capabilityId);
        const roadmapPath = join(root, "Docs", "Product", "PRODUCT_CONSTRUCTION_ROADMAP.json");
        if (existsSync(roadmapPath)) {
            try {
                const roadmap = JSON.parse(readFileSync(roadmapPath, "utf8")) as {
                    capabilities?: Array<{ capabilityId?: string; implementationPath?: string; testPath?: string; documentationPath?: string }>;
                };
                const capability = roadmap.capabilities?.find(item => item.capabilityId === canonicalId);
                const ownedPaths = [capability?.implementationPath, capability?.testPath, capability?.documentationPath].filter(Boolean) as string[];
                for (const relativePath of ownedPaths) {
                    execFileSync("git", ["clean", "-fd", "--", relativePath], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
                }
            } catch {
                // Rollback remains safe even when the product roadmap is unavailable.
            }
        }

        const status = execFileSync(
            "git",
            ["status", "--porcelain=v1", "--untracked-files=all", "--", ".", ":(exclude)node_modules"],
            { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
        ).trim();
        if (status) throw new Error(`Checkpoint rollback did not restore a clean worktree for ${checkpoint.commit}: ${status}`);
    }
}
