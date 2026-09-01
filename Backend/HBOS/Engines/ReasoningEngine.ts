import { execFileSync } from "node:child_process";
import { Engine } from "../Core/Engine";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";

export interface ReasoningResult {
    problem: string;
    status: string;
    success: boolean;
    answer?: string;
}

export interface ReasoningProvenance {
    readonly traceId: string;
    readonly inputHash: string;
    readonly outputHash?: string;
    readonly timestamp: string;
    readonly verificationStatus: "VERIFIED" | "PENDING" | "FAILED";
}

/** Canonical HBOS reasoning owner; delegates evidence-bound reasoning to the Python AI Runtime. */
export class ReasoningEngine implements Engine {
    name = "ReasoningEngine";

    initialize(): void {
        console.log("ReasoningEngine Started");
    }

    health(): boolean {
        return true;
    }

    /**
     * Reason with provenance tracking.
     * B2: Reasoning evidence traceability
     * P2: Trustworthy intelligence
     */
    reason(problem: string): ReasoningResult & { provenance?: ReasoningProvenance } {
        if (!problem || !problem.trim()) {
            return { 
                problem, 
                status: "invalid_problem", 
                success: false,
                provenance: this.createProvenance(problem, undefined)
            };
        }

        const inputHash = ProvenanceTrace.hashInput(problem);
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
                env: {
                    ...process.env,
                    PYTHONIOENCODING: "utf-8",
                    PYTHONUTF8: "1",
                },
                stdio: ["ignore", "pipe", "pipe"]
            }).trim();
            const result = JSON.parse(raw) as { problem: string; status: string; answer?: string };
            return { 
                problem: result.problem, 
                status: result.status, 
                success: true, 
                answer: result.answer,
                provenance: this.createProvenance(problem, result.answer)
            };
        } catch {
            return { 
                problem, 
                status: "reasoning_failed", 
                success: false,
                provenance: this.createProvenance(problem, undefined)
            };
        }
    }

    /**
     * Create provenance record for reasoning operation.
     */
    private createProvenance(input: string, output?: string): ReasoningProvenance {
        const timestamp = new Date().toISOString();
        return {
            traceId: ProvenanceTrace.createTraceId(),
            inputHash: ProvenanceTrace.hashInput(input),
            outputHash: output ? ProvenanceTrace.hashInput(output) : undefined,
            timestamp,
            verificationStatus: output ? "VERIFIED" : "PENDING"
        };
    }
}

