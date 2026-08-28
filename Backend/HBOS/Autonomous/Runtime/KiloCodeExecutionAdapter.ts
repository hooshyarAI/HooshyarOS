import { execFileSync } from "node:child_process";

export interface KiloExecutionResult {
    ok: boolean;
    code: number;
    output: string;
    error: string | null;
    elapsedMs: number;
}

export function kiloInvocation(platform: NodeJS.Platform, prompt: string): { command: string; args: string[]; shell: boolean } {
    return {
        command: platform === "win32" ? "kilo.cmd" : "kilo",
        args: ["run", "--auto", prompt],
        shell: platform === "win32"
    };
}

export class KiloCodeExecutionAdapter {
    constructor(private readonly runner = execFileSync) {}

    isAvailable(): boolean {
        try {
            const locator = process.platform === "win32" ? "where.exe" : "which";
            this.runner(locator, ["kilo"], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
            return true;
        } catch {
            return false;
        }
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
                stdio: ["ignore", "pipe", "pipe"]
            });
            return { ok: true, code: 0, output: String(output), error: null, elapsedMs: Date.now() - started };
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
