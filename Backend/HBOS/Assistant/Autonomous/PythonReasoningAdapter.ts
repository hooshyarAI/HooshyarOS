import { ReasoningEngine } from "../../Engines/ReasoningEngine";
import { ReasoningProvider } from "./ReasoningProvider";

export interface PythonReasoningResult {
    provider: "python";
    problem: string;
    status: string;
    success: boolean;
}

/**
 * Assistant-facing adapter for the canonical HBOS Reasoning Engine.
 * Python remains the repository-owned execution runtime; this adapter does
 * not duplicate Python process invocation or reasoning ownership.
 */
export class PythonReasoningAdapter implements ReasoningProvider {
    private readonly engine = new ReasoningEngine();

    async reason(prompt: string): Promise<PythonReasoningResult> {
        const result = this.engine.reason(prompt);
        return {
            provider: "python",
            problem: result.problem,
            status: result.status,
            success: result.success
        };
    }
}
