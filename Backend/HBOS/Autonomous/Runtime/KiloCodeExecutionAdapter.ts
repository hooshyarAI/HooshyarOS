/// <reference types="node" />
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface KiloExecutionResult {
    ok: boolean;
    code: number;
    output: string;
    error: string | null;
    elapsedMs: number;
    observable: boolean;
    progressLogPath?: string;
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

    return {
        command: cli || (platform === "win32" ? "kilo.exe" : "kilo"),
        args: ["run", "--auto", prompt],
        shell: false,
        env: environment
    };
}

export function buildWindowsKiloScript(payloadPath: string): string {
    const safePayloadPath = payloadPath.replace(/'/g, "''");
    return [
        "$ErrorActionPreference = 'Continue'",
        `$payload = Get-Content -Raw -LiteralPath '${safePayloadPath}' | ConvertFrom-Json`,
        `Write-Host ("[KILO] EXECUTION_STARTED command=" + $payload.command + " cwd=" + (Get-Location).Path)`,
        `& $payload.command @($payload.args) 2>&1 | ForEach-Object { $line = $_.ToString(); Add-Content -LiteralPath $payload.logPath -Value $line; Write-Host ("[KILO] " + $line) }`,
        "$code = $LASTEXITCODE",
        "if ($null -eq $code) { $code = 0 }",
        "Write-Host (\"[KILO] EXECUTION_FINISHED code=\" + $code)",
        "exit [int]$code"
    ].join("\r\n");
}

function streamWindowsKilo(invocation: KiloCommand, cwd: string, timeout: number): KiloExecutionResult {
    const started = Date.now();
    const workDir = join(tmpdir(), `hooshyar-kilo-${process.pid}-${started}`);
    mkdirSync(workDir, { recursive: true });
    const progressLogPath = join(workDir, "progress.log");
    const payloadPath = join(workDir, "payload.json");
    const scriptPath = join(workDir, "run-kilo.ps1");
    const heartbeatCommand = process.env.ComSpec || "powershell.exe";
    const heartbeatArgs = process.env.ComSpec
        ? ["/d", "/s", "/c", "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "$s=Get-Date; while($true){ Write-Host ('[KILO] HEARTBEAT state=RUNNING elapsedSeconds=' + [int]((Get-Date)-$s).TotalSeconds); Start-Sleep -Seconds 5 }"]
        : ["-NoProfile", "-NonInteractive", "-Command", "$s=Get-Date; while($true){ Write-Host ('[KILO] HEARTBEAT state=RUNNING elapsedSeconds=' + [int]((Get-Date)-$s).TotalSeconds); Start-Sleep -Seconds 5 }"];

    writeFileSync(payloadPath, JSON.stringify({
        command: invocation.command,
        args: invocation.args,
        logPath: progressLogPath
    }), "utf8");

    writeFileSync(scriptPath, buildWindowsKiloScript(payloadPath), "utf8");

    console.log(JSON.stringify({
        type: "AUTONOMOUS_AGENT_PROGRESS",
        provider: "kilo",
        phase: "START",
        event: "EXECUTION_STARTED",
        command: invocation.command,
        cwd,
        progressLogPath,
        liveOutput: true,
        heartbeatSeconds: 5,
        timestamp: new Date().toISOString()
    }));

    const heartbeat = spawn(heartbeatCommand, heartbeatArgs, {
        cwd,
        env: invocation.env,
        stdio: ["ignore", "inherit", "inherit"],
        windowsHide: false
    });

    const child = spawnSync(
        process.env.ComSpec || "powershell.exe",
        process.env.ComSpec
            ? ["/d", "/s", "/c", "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath]
            : ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath],
        {
            cwd,
            env: invocation.env,
            timeout,
            stdio: ["ignore", "inherit", "inherit"],
            windowsHide: false
        }
    );

    heartbeat.kill();

    const output = existsSync(progressLogPath) ? readFileSync(progressLogPath, "utf8") : "";
    const code = child.status ?? 1;
    const error = child.error ? child.error.message : code === 0 ? null : `Kilo exited with code ${code}`;

    console.log(JSON.stringify({
        type: "AUTONOMOUS_AGENT_PROGRESS",
        provider: "kilo",
        phase: "END",
        event: "EXECUTION_FINISHED",
        code,
        observable: true,
        liveOutput: true,
        heartbeatSeconds: 5,
        progressLogPath,
        elapsedMs: Date.now() - started,
        timestamp: new Date().toISOString()
    }));

    return {
        ok: code === 0,
        code,
        output,
        error,
        elapsedMs: Date.now() - started,
        observable: true,
        progressLogPath
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
        const invocation = kiloInvocation(process.platform, prompt);

        if (process.platform === "win32" && this.runner === execFileSync) {
            return streamWindowsKilo(invocation, cwd, timeout);
        }

        const started = Date.now();
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
                elapsedMs: Date.now() - started,
                observable: false
            };
        } catch (error: any) {
            return {
                ok: false,
                code: error?.status ?? 1,
                output: `${String(error?.stdout || "")}\n${String(error?.stderr || "")}`,
                error: error?.message ?? "kilo execution failed",
                elapsedMs: Date.now() - started,
                observable: false
            };
        }
    }
}
