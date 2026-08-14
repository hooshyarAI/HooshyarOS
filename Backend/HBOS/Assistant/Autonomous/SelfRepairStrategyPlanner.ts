import { RepairCluster } from "../../Autonomous/Runtime/AutonomousFailureAnalysisEngine";

export type RepairDepth = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RepairStrategyKind =
    | "FOCUSED_CANONICAL_REPAIR"
    | "ARCHITECTURAL_REPAIR"
    | "DEPENDENCY_PROVISIONING"
    | "ISOLATION_OR_FALLBACK"
    | "DEEPER_REDESIGN";

export interface SelfRepairPlan {
    depth: RepairDepth;
    strategy: RepairStrategyKind;
    rationale: string;
    constraints: string[];
    verification: string[];
}

/** Selects the smallest sufficient repair method and escalates only when evidence justifies it. */
export class SelfRepairStrategyPlanner {
    plan(cluster: RepairCluster | null, failures: string[], previousStrategies: RepairStrategyKind[] = []): SelfRepairPlan {
        const text = `${cluster?.rootCause ?? ""} ${cluster?.rationale ?? ""} ${failures.join(" ")}`.toLowerCase();
        const critical = /release|security|architecture|data loss|corrupt|production/.test(text);
        const high = critical || failures.length >= 3 || /dependency|toolchain|android|gradle|jdk/.test(text);
        const medium = high || failures.length >= 2;
        const ordered: RepairStrategyKind[] = high
            ? ["FOCUSED_CANONICAL_REPAIR", "ARCHITECTURAL_REPAIR", "DEPENDENCY_PROVISIONING", "ISOLATION_OR_FALLBACK", "DEEPER_REDESIGN"]
            : medium
                ? ["FOCUSED_CANONICAL_REPAIR", "ARCHITECTURAL_REPAIR", "ISOLATION_OR_FALLBACK", "DEEPER_REDESIGN"]
                : ["FOCUSED_CANONICAL_REPAIR", "ARCHITECTURAL_REPAIR", "DEEPER_REDESIGN"];
        const strategy = ordered.find(candidate => !previousStrategies.includes(candidate)) ?? "DEEPER_REDESIGN";
        const depth: RepairDepth = critical ? "CRITICAL" : high ? "HIGH" : medium ? "MEDIUM" : "LOW";
        return {
            depth,
            strategy,
            rationale: cluster
                ? `${cluster.rationale}; selected ${strategy} at ${depth} depth from root-cause evidence and prior attempts.`
                : `No classified cluster is available; selected ${strategy} at ${depth} depth without bypassing autonomous analysis.`,
            constraints: [
                "Preserve architecture ownership and frozen boundaries.",
                "Do not weaken acceptance or verification gates to make the failure disappear.",
                "Do not repeat a previously failed strategy without materially new evidence."
            ],
            verification: [
                "Re-run the narrow failing verification first.",
                "Run affected regression coverage before advancing the mission.",
                "Require clean repository and checkpoint evidence before resume."
            ]
        };
    }
}
