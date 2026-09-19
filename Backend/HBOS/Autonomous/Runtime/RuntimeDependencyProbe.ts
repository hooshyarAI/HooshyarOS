import { spawnSync } from "node:child_process";
import type { ReasoningProviderId } from "../../Engines/ReasoningEngine";

/**
 * Canonical runtime dependency probe (non-Engine utility).
 *
 * The commercial runtime's reasoning boundary ships with a deterministic,
 * in-process, Node-native evidence-bound provider, so the installed product
 * never requires an external interpreter to reason. The Python AI Runtime
 * (`Backend/AI_Runtime/reasoning/reasoning_engine.py`) remains an explicitly
 * configured optional provider.
 *
 * This probe only resolves and reports the dependency; it never fabricates
 * availability and never throws.
 */

export interface ReasoningRuntimeDependency {
    readonly id: "reasoning-runtime";
    readonly provider: ReasoningProviderId;
    readonly available: boolean;
    readonly source: "HOOSHYAR_PYTHON" | "NODE";
    readonly detail: "resolved" | "unresolved";
}

export interface RuntimeDependencyReport {
    readonly reasoningRuntime: ReasoningRuntimeDependency;
}

export type RuntimeProbe = (command: string) => boolean;

const defaultProbe: RuntimeProbe = (command) => {
    try {
        const result = spawnSync(command, ["--version"], { stdio: "ignore", windowsHide: true, timeout: 5000 });
        return result.status === 0;
    } catch {
        return false;
    }
};

export class RuntimeDependencyProbe {
    private readonly env: NodeJS.ProcessEnv;
    private readonly probe: RuntimeProbe;

    constructor(options: { readonly env?: NodeJS.ProcessEnv; readonly probe?: RuntimeProbe } = {}) {
        this.env = options.env ?? process.env;
        this.probe = options.probe ?? defaultProbe;
    }

    reasoningRuntime(): ReasoningRuntimeDependency {
        const configured = this.env.HOOSHYAR_PYTHON;
        const useConfigured = typeof configured === "string" && configured.trim().length > 0;

        // Without an explicit override the canonical Node-native provider always
        // serves reasoning in-process; no external interpreter is required.
        if (!useConfigured) {
            return {
                id: "reasoning-runtime",
                provider: "node-native",
                available: true,
                source: "NODE",
                detail: "resolved",
            };
        }

        // An explicit HOOSHYAR_PYTHON is authoritative: if it cannot be resolved
        // the reasoning boundary fails closed rather than silently switching.
        let available = false;
        try {
            available = this.probe(configured.trim());
        } catch {
            available = false;
        }
        return {
            id: "reasoning-runtime",
            provider: "python",
            available,
            source: "HOOSHYAR_PYTHON",
            detail: available ? "resolved" : "unresolved",
        };
    }

    report(): RuntimeDependencyReport {
        return { reasoningRuntime: this.reasoningRuntime() };
    }
}
