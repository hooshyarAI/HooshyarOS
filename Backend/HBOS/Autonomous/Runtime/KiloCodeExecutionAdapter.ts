/// <reference types="node" />
import { execFileSync, spawnSync } from "node:child_process";
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

const GOVERNED_OPERATOR_PROMPT = [
    "You are the HooshyarOS governed construction operator.",
    "The current mission prompt is the authoritative mission capsule.",
    "Work directly on the declared Required artifact paths and the explicitly listed direct dependency paths only.",
    "Read the named governance and architecture documents once, then inspect only the exact mission files supplied by the runtime.",
    "Do not perform repository-wide exploration, recursive scans, search, grep, glob, or speculative dependency discovery.",
    "Do not read arbitrary directories. If an explicitly named dependency is a directory or its exact file path cannot be resolved from the mission capsule, perform at most one narrow directory read to locate that dependency, then return to the declared paths.",
    "Do not use the Task tool and do not delegate to any subagent.",
    "Do not use web search, web fetch, skills, todo tools, or broad repository discovery.",
    "Do not use shell or terminal commands. All repository inspection and edits must use the explicitly permitted file tools.",
    "Every read must answer a specific unresolved question from the mission capsule.",
    "After the supplied mission files and direct dependencies are understood, decide and act: implement the genuinely missing part, complete the canonical artifact, or report the capability as already complete/idempotent.",
    "Do not create duplicate engines, duplicate product artifact owners, alternate paths, or a second capability owner.",
    "For product missions, preserve the durable product roadmap and Architecture Freeze V4.",
    "Do not change git history, commit, push, reset, clean, or erase unrelated changes; the autonomous runtime owns Git lifecycle.",
    "Do not repeat a read. If evidence is insufficient, report the exact missing evidence and stop.",
    "A successful run ends with concrete implementation/test/document changes or an explicit idempotent conclusion; exploration without a decision is not success."
].join("\n");

const FREE_MODEL_CONFIG = JSON.stringify({
    model: "kilo/kilo-auto/free"
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

function resolveKiloCliPathWithRunner(runner: typeof execFileSync): string | null {
    const locator = process.platform === "win32" ? "where.exe" : "which";
    const executable = process.platform === "win32" ? "kilo.exe" : "kilo";
    try {
        const output = String(runner(locator, [executable], {
            encoding: "utf8",
            windowsHide: true,
            stdio: ["ignore", "pipe", "ignore"]
        })).trim().split(/\r?\n/)[0];
        if (output) return output;
    } catch {
        if (runner !== execFileSync) return null;
    }

    for (const candidate of candidateCliPaths()) {
        if (existsSync(candidate)) return candidate;
    }

    return null;
}

export function resolveKiloCliPath(): string | null {
    return resolveKiloCliPathWithRunner(execFileSync);
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
    return {
        command: cli || (platform === "win32" ? "kilo.exe" : "kilo"),
        args: ["run", "--agent", "hooshyar-construction", "--auto", prompt],
        shell: false,
        env: buildEnvironment()
    };
}

export function buildWindowsKiloScript(payloadPath: string): string {
    const safePayloadPath = payloadPath.replace(/'/g, "''");
    return [
        "$ErrorActionPreference = 'Continue'",
        "function Emit-KiloLine([string]$line) {",
        "  if (-not $line) { return }",
        "  Add-Content -LiteralPath $payload.logPath -Value $line",
        "  Write-Host (\"[KILO] \" + $line)",
        "}",
        "function Read-SharedText([string]$path) {",
        "  if (-not (Test-Path -LiteralPath $path)) { return '' }",
        "  $stream = $null",
        "  $reader = $null",
        "  try {",
        "    $stream = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)",
        "    $reader = New-Object System.IO.StreamReader($stream)",
        "    return $reader.ReadToEnd()",
        "  } catch { return '' }",
        "  finally { if ($reader) { $reader.Dispose() } elseif ($stream) { $stream.Dispose() } }",
        "}",
        `$payload = Get-Content -Raw -LiteralPath '${safePayloadPath}' | ConvertFrom-Json`,
        "Emit-KiloLine 'EXECUTION_STARTED'",
        "$stdoutPath = $payload.logPath + '.stdout'",
        "$stderrPath = $payload.logPath + '.stderr'",
        "Remove-Item -LiteralPath $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue",
        "$child = Start-Process -FilePath $payload.command -ArgumentList $payload.args -WorkingDirectory (Get-Location).Path -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru -WindowStyle Normal",
        "Emit-KiloLine (\"PROCESS_STARTED pid=\" + $child.Id + \" command=\" + $payload.command)",
        "$stdoutOffset = 0",
        "$stderrOffset = 0",
        "while (-not $child.HasExited) {",
        "  foreach ($stream in @(@($stdoutPath, 'STDOUT'), @($stderrPath, 'STDERR'))) {",
        "    $path = $stream[0]; $label = $stream[1]",
        "    if (Test-Path -LiteralPath $path) {",
        "      $raw = Read-SharedText $path",
        "      $offset = if ($label -eq 'STDOUT') { $stdoutOffset } else { $stderrOffset }",
        "      if ($raw.Length -gt $offset) {",
        "        $delta = $raw.Substring($offset)",
        "        $delta -split \"`r?`n\" | ForEach-Object { if ($_) { Emit-KiloLine (\"[\" + $label + \"] \" + $_) } }",
        "        if ($label -eq 'STDOUT') { $stdoutOffset = $raw.Length } else { $stderrOffset = $raw.Length }",
        "      }",
        "    }",
        "  }",
        "  Emit-KiloLine (\"HEARTBEAT pid=\" + $child.Id + \" state=RUNNING elapsedSeconds=\" + [int]((Get-Date) - $child.StartTime).TotalSeconds)",
        "  Start-Sleep -Seconds 5",
        "  $child.Refresh()",
        "}",
        "$child.Refresh()",
        "foreach ($stream in @(@($stdoutPath, 'STDOUT'), @($stderrPath, 'STDERR'))) {",
        "  $path = $stream[0]; $label = $stream[1]",
        "  if (Test-Path -LiteralPath $path) {",
        "    $raw = Read-SharedText $path",
        "    $offset = if ($label -eq 'STDOUT') { $stdoutOffset } else { $stderrOffset }",
        "    if ($raw.Length -gt $offset) {",
        "      $delta = $raw.Substring($offset)",
        "      $delta -split \"`r?`n\" | ForEach-Object { if ($_) { Emit-KiloLine (\"[\" + $label + \"] \" + $_) } }",
        "    }",
        "  }",
        "}",
        "$code = $child.ExitCode",
        "Emit-KiloLine (\"EXECUTION_FINISHED code=\" + $code)",
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

    const output = existsSync(progressLogPath) ? readFileSync(progressLogPath, "utf8") : "";
    const timedOut = String((child.error as any)?.code ?? "") === "ETIMEDOUT";

    if (timedOut) {
        const pidMatch = output.match(/PROCESS_STARTED pid=(\d+)/);
        if (pidMatch?.[1]) {
            try {
                execFileSync(
                    process.env.ComSpec || "cmd.exe",
                    ["/d", "/s", "/c", "taskkill", "/PID", pidMatch[1], "/T", "/F"],
                    {
                        encoding: "utf8",
                        windowsHide: true,
                        stdio: ["ignore", "pipe", "ignore"]
                    }
                );
            } catch {
                // The child may have exited between timeout and cleanup.
            }
        }
    }

    const code = timedOut ? 124 : (child.status ?? 1);
    const error = timedOut
        ? "Kilo execution timed out and its process tree was terminated"
        : child.error
            ? child.error.message
            : code === 0
                ? null
                : `Kilo exited with code ${code}`;

    console.log(JSON.stringify({
        type: "AUTONOMOUS_AGENT_PROGRESS",
        provider: "kilo",
        phase: "END",
        event: timedOut ? "EXECUTION_TIMEOUT" : "EXECUTION_FINISHED",
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
        return resolveKiloCliPathWithRunner(this.runner);
    }

    isAvailable(): boolean {
        return Boolean(this.resolveCliPath());
    }

    execute(prompt: string, cwd: string, timeout = 30 * 60 * 1000): KiloExecutionResult {
        const normalizedPrompt = prompt.toLowerCase();
        const protectedCapabilities = [
            "product.financial-data-ingestion",
            "repair-product.financial-data-ingestion"
        ];

        if (protectedCapabilities.some(capability => normalizedPrompt.includes(capability))) {
            return {
                ok: false,
                code: 125,
                output: "",
                error: "PROTECTED_CAPABILITY: Financial Data Ingestion Adapter is outside the Kilo execution scope",
                elapsedMs: 0,
                observable: true
            };
        }

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
