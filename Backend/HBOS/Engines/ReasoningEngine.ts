import { execFileSync } from "node:child_process";
import { Engine } from "../Core/Engine";

export interface ReasoningResult {
    problem: string;
    status: string;
    success: boolean;
}

/** Canonical HBOS reasoning owner; delegates model-independent reasoning to the Python AI Runtime. */
export class ReasoningEngine implements Engine {
    name = "ReasoningEngine";

    initialize(): void {
        console.log("ReasoningEngine Started");
    }

    health(): boolean {
        return true;
    }

    reason(problem: string): ReasoningResult {
        if (!problem || !problem.trim()) {
            return { problem, status: "invalid_problem", success: false };
        }

        const python = process.env.HOOSHYAR_PYTHON || "python";
        const script = [
            "import json, sys",
            "from Backend.AI_Runtime.reasoning.reasoning_engine import ReasoningEngine as PythonReasoningEngine",
            "result = PythonReasoningEngine().reason(sys.argv[1])",
            "print(json.dumps(result, ensure_ascii=False))"
        ].join("; ");

        try {
            const raw = execFileSync(python, ["-c", script, problem], {
                cwd: process.cwd(),
                encoding: "utf8",
                windowsHide: true,
                stdio: ["ignore", "pipe", "pipe"]
            }).trim();
            const result = JSON.parse(raw) as { problem: string; status: string };
            return { problem: result.problem, status: result.status, success: true };
        } catch {
            return { problem, status: "reasoning_failed", success: false };
        }
    }
}
