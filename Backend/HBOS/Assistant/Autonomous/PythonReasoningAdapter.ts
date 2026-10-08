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
 * The canonical engine serves deterministic in-process reasoning by default
 * and delegates to the repository-native Python runtime only when the operator
 * explicitly configures it; this adapter never duplicates reasoning ownership.
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
