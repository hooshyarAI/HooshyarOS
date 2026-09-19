import { spawnSync } from "node:child_process";

/**
 * Canonical runtime dependency probe (non-Engine utility).
 *
 * The commercial runtime's reasoning/narrative boundary is served by the
 * repository-native Python AI Runtime (`Backend/AI_Runtime`). The installed
 * Windows product ships a Node runtime but does not currently ship a Python
 * interpreter, so the reasoning boundary must be reported truthfully instead
 * of being satisfied accidentally by the developer machine's PATH.
 *
 * This probe only resolves and reports the dependency; it never fabricates
 * availability and never throws.
 */

export interface ReasoningRuntimeDependency {
    readonly id: "python-reasoning-runtime";
    readonly available: boolean;
    readonly source: "HOOSHYAR_PYTHON" | "PATH";
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
        const command = useConfigured ? configured.trim() : "python";
        let available = false;
        try {
            available = this.probe(command);
        } catch {
            available = false;
        }
        return {
            id: "python-reasoning-runtime",
            available,
            source: useConfigured ? "HOOSHYAR_PYTHON" : "PATH",
            detail: available ? "resolved" : "unresolved",
        };
    }

    report(): RuntimeDependencyReport {
        return { reasoningRuntime: this.reasoningRuntime() };
    }
}
