import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface KiloExecutionResult {
    ok: boolean;
    code: number;
    output: string;
    error: string | null;
    elapsedMs: number;
}

export interface KiloCommand {
    command: string;
    args: string[];
    shell: boolean;
    env: NodeJS.ProcessEnv;
}

const FREE_MODEL_CONFIG = JSON.stringify({
    model: "kilo/kilo-auto/free",
    agent: {
        "hooshyar-construction": { model: "kilo/kilo-auto/free" },
        "hooshyar-repair": { model: "kilo/kilo-auto/free" }
    }
});

function candidateCliPaths(): string[] {
    const home = process.env.USERPROFILE || process.env.HOME || "";
    const extensionRoot = join(home, ".vscode", "extensions");
    return [
        process.env.KILO_CLI_PATH || "",
        join(extensionRoot, "kilocode.kilo-code-7.5.6-win32-x64", "bin", "kilo.exe"),
        join(extensionRoot, "kilocode.kilo-code-7.5.6-win32-x64", "bin", "kilo.cmd")
    ].filter(Boolean);
}

export function resolveKiloCliPath(): string | null {
    try {
        const locator = process.platform === "win32" ? "where.exe" : "which";
        const executable = process.platform === "win32" ? "kilo.exe" : "kilo";
        const output = execFileSync(locator, [executable], {
            encoding: "utf8",
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"]
        }).trim().split(/\r?\n/)[0];
        if (output) return output;
    } catch {}

    for (const candidate of candidateCliPaths()) {
        if (existsSync(candidate)) return candidate;
    }

    return null;
}

function buildEnvironment(): NodeJS.ProcessEnv {
    return {
        ...process.env,
        HOOSHYAR_AGENT: "kilo",
        KILO_CONFIG_CONTENT: FREE_MODEL_CONFIG
    };
}

export function kiloInvocation(platform: NodeJS.Platform, prompt: string): KiloCommand {
    const cli = resolveKiloCliPath();
    const environment = buildEnvironment();

    if (platform === "win32") {
        if (!cli) {
            return {
                command: "kilo.exe",
                args: ["run", "--auto", prompt],
                shell: false,
                env: environment
            };
        }
        return {
            command: cli,
            args: ["run", "--auto", prompt],
            shell: false,
            env: environment
        };
    }

    return {
        command: cli || "kilo",
        args: ["run", "--auto", prompt],
        shell: false,
        env: environment
    };
}

export class KiloCodeExecutionAdapter {
    constructor(private readonly runner = execFileSync) {}

    resolveCliPath(): string | null {
        return resolveKiloCliPath();
    }

    isAvailable(): boolean {
        return Boolean(this.resolveCliPath());
    }

    execute(prompt: string, cwd: string, timeout = 30 * 60 * 1000): KiloExecutionResult {
        const started = Date.now();
        const invocation = kiloInvocation(process.platform, prompt);

        try {
            const output = this.runner(invocation.command, invocation.args, {
                cwd,
                encoding: "utf8",
                timeout,
                shell: invocation.shell,
                windowsHide: true,
                env: invocation.env,
                stdio: ["ignore", "pipe", "pipe"]
            });

            return {
                ok: true,
                code: 0,
                output: String(output),
                error: null,
                elapsedMs: Date.now() - started
            };
        } catch (error: any) {
            return {
                ok: false,
                code: error?.status ?? 1,
                output: `${String(error?.stdout || "")}\n${String(error?.stderr || "")}`,
                error: error?.message ?? "kilo execution failed",
                elapsedMs: Date.now() - started
            };
        }
    }
}
