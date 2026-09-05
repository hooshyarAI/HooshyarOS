/// <reference types="node" />
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
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
    const candidates: string[] = [];
    if (process.env.KILO_CLI_PATH) candidates.push(process.env.KILO_CLI_PATH);
    // Version-agnostic discovery: the Kilo Code VS Code extension version is not
    // pinned. Any installed `kilocode.kilo-code-*` extension directory is a valid
    // candidate so the adapter never depends on a hardcoded extension version.
    try {
        if (existsSync(extensionRoot)) {
            for (const entry of readdirSync(extensionRoot)) {
                if (/^kilocode\.kilo-code-/.test(entry)) {
                    const dir = join(extensionRoot, entry, "bin");
                    candidates.push(join(dir, "kilo.exe"), join(dir, "kilo.cmd"));
                }
            }
        }
    } catch {
        // Extension root unavailable; `where.exe`/KILO_CLI_PATH remain the fallbacks.
    }
    return candidates.filter(Boolean);
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
        "$command = $payload.command",
        "$extension = [System.IO.Path]::GetExtension($command).ToString().ToLower()",
        "if ($extension -eq '.cmd' -or $extension -eq '.bat') {",
        "  $launchCommand = 'cmd.exe'",
        "  $launchArgs = @('/c', $command) + $payload.args",
        "} else {",
        "  $launchCommand = $command",
        "  $launchArgs = $payload.args",
        "}",
        "$child = Start-Process -FilePath $launchCommand -ArgumentList $launchArgs -WorkingDirectory (Get-Location).Path -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru -NoNewWindow",
        "Set-Content -LiteralPath $payload.pidPath -Value $child.Id -NoNewline",
        "Emit-KiloLine (\"PROCESS_STARTED pid=\" + $child.Id + \" command=\" + $launchCommand)",
        "$startTime = Get-Date",
        "$stdoutOffset = 0",
        "$stderrOffset = 0",
        "while (-not $child.HasExited) {",
        "  $elapsedMs = ((Get-Date) - $startTime).TotalMilliseconds",
        "  if ($elapsedMs -gt $payload.timeout) {",
        "    Emit-KiloLine 'EXECUTION_TIMEOUT'",
        "    & taskkill /PID $child.Id /T /F 2>`$null",
        "    exit 124",
        "  }",
        "  if (Test-Path -LiteralPath $stdoutPath) {",
        "    $raw = Read-SharedText $stdoutPath",
        "    if ($raw.Length -gt $stdoutOffset) {",
        "      $delta = $raw.Substring($stdoutOffset)",
        "      $delta -split \"`r?`n\" | ForEach-Object { if ($_) { Emit-KiloLine (\"[STDOUT] \" + $_) } }",
        "      $stdoutOffset = $raw.Length",
        "    }",
        "  }",
        "  if (Test-Path -LiteralPath $stderrPath) {",
        "    $raw = Read-SharedText $stderrPath",
        "    if ($raw.Length -gt $stderrOffset) {",
        "      $delta = $raw.Substring($stderrOffset)",
        "      $delta -split \"`r?`n\" | ForEach-Object { if ($_) { Emit-KiloLine (\"[STDERR] \" + $_) } }",
        "      $stderrOffset = $raw.Length",
        "    }",
        "  }",
        "  Emit-KiloLine (\"HEARTBEAT pid=\" + $child.Id + \" state=RUNNING elapsedSeconds=\" + [int]((Get-Date) - $child.StartTime).TotalSeconds)",
        "  Start-Sleep -Seconds 5",
        "  $child.Refresh()",
        "}",
        "$child.Refresh()",
        "if (Test-Path -LiteralPath $stdoutPath) {",
        "  $raw = Read-SharedText $stdoutPath",
        "  if ($raw.Length -gt $stdoutOffset) {",
        "    $delta = $raw.Substring($stdoutOffset)",
        "    $delta -split \"`r?`n\" | ForEach-Object { if ($_) { Emit-KiloLine (\"[STDOUT] \" + $_) } }",
        "  }",
        "}",
        "if (Test-Path -LiteralPath $stderrPath) {",
        "  $raw = Read-SharedText $stderrPath",
        "  if ($raw.Length -gt $stderrOffset) {",
        "    $delta = $raw.Substring($stderrOffset)",
        "    $delta -split \"`r?`n\" | ForEach-Object { if ($_) { Emit-KiloLine (\"[STDERR] \" + $_) } }",
        "  }",
        "}",
        "$code = $child.ExitCode",
        "Emit-KiloLine (\"EXECUTION_FINISHED code=\" + $code)",
        "exit [int]$code"
    ].join("\r\n");
}

function processTreePidExists(pid: number): boolean {
    try {
        const output = execFileSync(
            process.env.ComSpec || "cmd.exe",
            ["/d", "/s", "/c", "tasklist", "/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"],
            {
                encoding: "utf8",
                windowsHide: true,
                stdio: ["ignore", "pipe", "ignore"]
            }
        );
        return output
            .split(/\r?\n/)
            .some(line => line.split(",").map(cell => cell.replace(/"/g, "").trim()).includes(String(pid)));
    } catch {
        return false;
    }
}

function killProcessTree(rootPid: number): void {
    try {
        execFileSync(
            process.env.ComSpec || "cmd.exe",
            ["/d", "/s", "/c", "taskkill", "/PID", String(rootPid), "/T", "/F"],
            {
                encoding: "utf8",
                windowsHide: true,
                stdio: ["ignore", "pipe", "ignore"]
            }
        );
    } catch {
        // Tree may have already exited; verification below is authoritative.
    }
}

function streamWindowsKilo(invocation: KiloCommand, cwd: string, timeout: number): KiloExecutionResult {
    const started = Date.now();
    const workDir = join(tmpdir(), `hooshyar-kilo-${process.pid}-${started}`);
    mkdirSync(workDir, { recursive: true });
    const progressLogPath = join(workDir, "progress.log");
    const pidPath = join(workDir, "kilo.pid");
    const payloadPath = join(workDir, "payload.json");
    const scriptPath = join(workDir, "run-kilo.ps1");

    writeFileSync(payloadPath, JSON.stringify({
        command: invocation.command,
        args: invocation.args,
        logPath: progressLogPath,
        pidPath,
        timeout
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
        const innerPidRaw = existsSync(pidPath) ? readFileSync(pidPath, "utf8").trim() : null;
        const innerPid = innerPidRaw && /^\d+$/.test(innerPidRaw) ? parseInt(innerPidRaw, 10) : null;

        if (innerPid !== null) {
            killProcessTree(innerPid);
        }
        if (child.pid) {
            killProcessTree(child.pid);
        }

        if (innerPid !== null) {
            const deadline = Date.now() + 5000;
            let rootGone = false;
            while (Date.now() < deadline) {
                if (!processTreePidExists(innerPid)) {
                    rootGone = true;
                    break;
                }
                try {
                    execFileSync(
                        process.env.ComSpec || "cmd.exe",
                        ["/d", "/s", "/c", "timeout", "/t", "1", "/nobreak"],
                        { windowsHide: true, stdio: ["ignore", "ignore", "ignore"] }
                    );
                } catch {
                    break;
                }
            }
            if (!rootGone && processTreePidExists(innerPid)) {
                console.error(JSON.stringify({
                    type: "AUTONOMOUS_TOOL_ERROR",
                    event: "TREE_TERMINATION_INCOMPLETE",
                    provider: "kilo",
                    rootPid: innerPid,
                    timestamp: new Date().toISOString()
                }));
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
