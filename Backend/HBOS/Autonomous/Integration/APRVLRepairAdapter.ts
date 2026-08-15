import { spawn } from "node:child_process";

export interface APRVLRepairRequest {
  readonly issueType: string;
  readonly failureOutput: string;
  readonly rootPath?: string;
}

export interface APRVLRepairEvidence {
  /** APRVL never grants governance authorization; authorization is owned by HooshyarOS. */
  readonly authorized: false;
  readonly verified: boolean;
  readonly summary: string;
}

/**
 * Governance-owned boundary to the real APRVL Python runner.
 * Python may detect/analyze and produce evidence; it never authorizes repair.
 */
export interface APRVLRepairAdapter {
  execute(request: APRVLRepairRequest): Promise<APRVLRepairEvidence>;
}

export class ProcessAPRVLRepairAdapter implements APRVLRepairAdapter {
  constructor(private readonly python = "python") {}

  async execute(request: APRVLRepairRequest): Promise<APRVLRepairEvidence> {
    const root = request.rootPath ?? process.cwd();
    const args = ["-m", "Backend.AI_Runtime.repair.aprvl", root, "--problem", request.issueType];

    return new Promise((resolve) => {
      const child = spawn(this.python, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      child.on("error", (error) => resolve({ authorized: false, verified: false, summary: `APRVL process error: ${error.message}` }));
      child.on("close", (code) => {
        if (code !== 0) {
          resolve({ authorized: false, verified: false, summary: stdout || stderr || `APRVL exited with code ${code}` });
          return;
        }
        try {
          const result = JSON.parse(stdout) as { status?: string; findings?: unknown[] };
          resolve({
            authorized: false,
            verified: result.status === "VERIFIED",
            summary: `APRVL ${result.status ?? "UNKNOWN"}; findings=${result.findings?.length ?? 0}`,
          });
        } catch {
          resolve({ authorized: false, verified: false, summary: "APRVL returned invalid evidence" });
        }
      });
    });
  }
}
