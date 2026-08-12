import { execFileSync } from "node:child_process";

export interface VerificationBootstrapResult {
    ok: boolean;
    installed: boolean;
    output: string;
    error: string | null;
}

export function ensurePytest(root: string): VerificationBootstrapResult {
    try {
        execFileSync("python", ["-c", "import pytest"], {
            cwd: root,
            stdio: "ignore",
            windowsHide: true
        });
        return { ok: true, installed: false, output: "pytest already available", error: null };
    } catch {
        try {
            const output = execFileSync("python", ["-m", "pip", "install", "pytest"], {
                cwd: root,
                encoding: "utf8",
                windowsHide: true,
                stdio: ["ignore", "pipe", "pipe"]
            });
            execFileSync("python", ["-c", "import pytest"], {
                cwd: root,
                stdio: "ignore",
                windowsHide: true
            });
            return { ok: true, installed: true, output: String(output), error: null };
        } catch (error: any) {
            return {
                ok: false,
                installed: false,
                output: String(error?.stdout || ""),
                error: String(error?.stderr || error?.message || "pytest bootstrap failed")
            };
        }
    }
}
