import { execFileSync } from "child_process";
import { ReasoningProvider } from "./ReasoningProvider";

export interface CanonicalReasoningResult {
    provider: "canonical";
    problem: string;
    status: string;
    success: boolean;
}

/**
 * Adapter to the repository-owned canonical Reasoning Engine.
 * HBOS does not implement a second reasoning engine; it delegates ownership
 * to Backend/AI_Runtime/reasoning/reasoning_engine.py.
 */
export class CloudReasoningAdapter implements ReasoningProvider {
    async reason(prompt: string): Promise<CanonicalReasoningResult> {
        const python = process.env.HOOSHYAR_PYTHON || "python";
        const script = [
            "import json, sys",
            "from Backend.AI_Runtime.reasoning.reasoning_engine import ReasoningEngine",
            "result = ReasoningEngine().reason(sys.argv[1])",
            "print(json.dumps(result, ensure_ascii=False))"
        ].join("; ");

        try {
            const raw = execFileSync(python, ["-c", script, prompt], {
                cwd: process.cwd(),
                encoding: "utf8",
                windowsHide: true,
                stdio: ["ignore", "pipe", "pipe"]
            }).trim();

            const result = JSON.parse(raw) as { problem: string; status: string };
            return {
                provider: "canonical",
                problem: result.problem,
                status: result.status,
                success: true
            };
        } catch (error: any) {
            return {
                provider: "canonical",
                problem: prompt,
                status: `reasoning_failed: ${error?.message || "unknown error"}`,
                success: false
            };
        }
    }
}
