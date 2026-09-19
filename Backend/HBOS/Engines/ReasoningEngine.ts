import { execFileSync } from "node:child_process";
import path from "node:path";
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
    // E1: Full provenance chain linkage
    readonly sourceRef: string;
    readonly transformationRef?: string;
    readonly reasoningSteps: readonly string[];
    // E3: Explainability
    readonly explainability?: {
        readonly inputSummary: string;
        readonly decisionBasis: string;
        readonly confidence?: number;
        readonly limitations?: readonly string[];
    };
}

/**
 * Canonical reasoning provider used for a call.
 *
 * `node-native` is the guaranteed, in-process, deterministic evidence-bound
 * provider that ships with the product runtime. `python` is an explicitly
 * configured optional provider that delegates to the repository-native Python
 * AI Runtime (`Backend/AI_Runtime/reasoning/reasoning_engine.py`).
 */
export type ReasoningProviderId = "node-native" | "python";

const NATIVE_TRANSFORMATION_REF = "node-evidence-reasoning";
const PYTHON_TRANSFORMATION_REF = "python-ai-runtime";

/**
 * Evidence-bound metric labels. They intentionally mirror the canonical
 * Python reasoning runtime (`reasoning_engine.py`) so the deterministic
 * explanation is identical no matter which provider serves the request.
 */
const METRIC_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
    ["revenue", /Revenue=([-+]?\d+(?:\.\d+)?)/],
    ["profit", /Profit=([-+]?\d+(?:\.\d+)?)/],
    ["profit_margin", /ProfitMargin=([-+]?\d+(?:\.\d+)?)/],
    ["debt_ratio", /DebtRatio=([-+]?\d+(?:\.\d+)?)/],
];

const NO_METRICS_ANSWER = "برای پاسخ مستند، ابتدا یک تحلیل مالی تأییدشده برای این نشست ثبت کنید.";

function trimTrailingZeros(text: string): string {
    if (!text.includes(".")) return text;
    return text.replace(/0+$/, "").replace(/\.$/, "");
}

/**
 * Deterministic `%g`-style number formatting for narrative values.
 * Mirrors the Python `f"{value:g}"` / `f"{value:.4g}"` output used by the
 * repository-native reasoning runtime.
 */
function formatG(value: number, precision = 6): string {
    if (!Number.isFinite(value)) return String(value);
    if (value === 0) return "0";
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    if (exponent < -4 || exponent >= precision) {
        const mantissa = value / Math.pow(10, exponent);
        const digits = trimTrailingZeros(mantissa.toPrecision(precision));
        const sign = exponent < 0 ? "-" : "+";
        return `${digits}e${sign}${String(Math.abs(exponent)).padStart(2, "0")}`;
    }
    return trimTrailingZeros(value.toPrecision(precision));
}

/**
 * Canonical HBOS reasoning owner.
 *
 * The product runtime must not depend on an external interpreter to reason.
 * The canonical provider is therefore a deterministic, in-process,
 * evidence-bound reasoner that reproduces the repository-native Python
 * reasoning contract exactly. The Python AI Runtime remains available as an
 * explicitly configured optional provider (`HOOSHYAR_PYTHON`) and, when
 * configured, is authoritative and fails closed.
 */
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
     * B2: Reasoning evidence traceability - real input/output hash in actual path
     * P2: Trustworthy intelligence - truthful status, no fabrication
     * E1: Decision provenance traceability - real source/input/reasoning linkage
     * E3: Explainability - reasoning chain when output is present
     */
    reason(problem: string): ReasoningResult & { provenance?: ReasoningProvenance } {
        if (!problem || !problem.trim()) {
            return {
                problem,
                status: "invalid_problem",
                success: false,
                provenance: this.createProvenance(problem, undefined, undefined, undefined, undefined)
            };
        }

        const configured = process.env.HOOSHYAR_PYTHON;
        const useConfigured = typeof configured === "string" && configured.trim().length > 0;

        // No explicit Python configuration: serve reasoning in-process.
        // This is the supported installed-product path and never depends on an
        // external interpreter being present.
        if (!useConfigured) {
            const native = this.reasonNative(problem);
            return {
                problem,
                status: native.status,
                success: true,
                answer: native.answer,
                provenance: this.createProvenance(problem, native.answer, native.steps, undefined, NATIVE_TRANSFORMATION_REF)
            };
        }

        // Explicit Python configuration is authoritative and fails closed.
        return this.reasonWithPython(problem, configured.trim());
    }

    /**
     * Deterministic, evidence-bound reasoning over verified context values.
     * Never invents thresholds, transactions or external facts.
     */
    private reasonNative(problem: string): { status: string; answer: string; steps: readonly string[] } {
        const metrics = new Map<string, number>();
        for (const [name, pattern] of METRIC_PATTERNS) {
            const match = problem.match(pattern);
            if (match) metrics.set(name, Number(match[1]));
        }

        const steps: string[] = ["extract-verified-context-metrics"];

        if (metrics.size === 0) {
            steps.push("no-verified-metrics-present");
            return { status: "reasoned", answer: NO_METRICS_ANSWER, steps };
        }

        const parts: string[] = [];
        if (metrics.has("revenue")) parts.push(`درآمد ثبت‌شده ${formatG(metrics.get("revenue")!)} است`);
        if (metrics.has("profit")) parts.push(`سود ثبت‌شده ${formatG(metrics.get("profit")!)} است`);
        if (metrics.has("profit_margin")) parts.push(`حاشیه سود ${formatG(metrics.get("profit_margin")!, 4)} است`);
        if (metrics.has("debt_ratio")) parts.push(`نسبت بدهی ${formatG(metrics.get("debt_ratio")!, 4)} است`);

        steps.push("compose-evidence-bound-explanation");
        return {
            status: "reasoned",
            answer: `${parts.join("؛ ")}. این پاسخ فقط بر پایه مقادیر تأییدشده موجود در context تولید شده است.`,
            steps,
        };
    }

    /**
     * Optional Python provider bridge. Only invoked when the operator has
     * explicitly configured `HOOSHYAR_PYTHON`; a configured-but-unusable
     * interpreter fails closed rather than silently changing providers.
     */
    private reasonWithPython(problem: string, python: string): ReasoningResult & { provenance?: ReasoningProvenance } {
        const script = [
            "import json, sys",
            "from Backend.AI_Runtime.reasoning.reasoning_engine import ReasoningEngine as PythonReasoningEngine",
            "result = PythonReasoningEngine().reason(sys.argv[1])",
            "print(json.dumps(result, ensure_ascii=False))"
        ].join("; ");

        try {
            const raw = execFileSync(python, ["-c", script, problem], {
                cwd: path.join(__dirname, "..", "..", ".."),
                encoding: "utf8",
                windowsHide: true,
                env: {
                    ...process.env,
                    PYTHONIOENCODING: "utf-8",
                    PYTHONUTF8: "1",
                },
                stdio: ["ignore", "pipe", "pipe"]
            }).trim();
            // Runtime result may optionally include a confidence field
            const result = JSON.parse(raw) as { problem: string; status: string; answer?: string; confidence?: number };
            return {
                problem: result.problem,
                status: result.status,
                success: true,
                answer: result.answer,
                provenance: this.createProvenance(problem, result.answer, undefined, result.confidence, PYTHON_TRANSFORMATION_REF)
            };
        } catch {
            return {
                problem,
                status: "reasoning_failed",
                success: false,
                provenance: this.createProvenance(problem, undefined, undefined, undefined, PYTHON_TRANSFORMATION_REF)
            };
        }
    }

    /**
     * Create provenance record for reasoning operation.
     * Integrates real ProvenanceTrace capability into the actual reasoning path.
     *
     * B2: Reasoning evidence traceability - real input/output hash tracking
     * P2: Trustworthy intelligence - truthful status, no fabrication
     * E1: Decision provenance traceability - real source/input/reasoning linkage
     * E3: Explainability - real reasoning chain when available
     *
     * Confidence is ONLY carried when the runtime actually provides a real
     * confidence value. If no confidence is supplied by the runtime, the
     * explainability record explicitly discloses this as a limitation
     * rather than fabricating a value.
     */
    private createProvenance(
        input: string,
        output: string | undefined,
        reasoningSteps: readonly string[] | undefined,
        runtimeConfidence: number | undefined,
        transformationRef: string
    ): ReasoningProvenance {
        const timestamp = new Date().toISOString();
        const traceId = ProvenanceTrace.createTraceId();
        const inputHash = ProvenanceTrace.hashInput(input);

        // Determine truthful verification status based on actual output availability
        const verificationStatus: ReasoningProvenance["verificationStatus"] = output ? "VERIFIED" : "PENDING";

        // E1: Source ref - mark as unavailable since we don't have upstream source context in this engine
        const sourceRef = "unavailable";

        // E1: Reasoning steps - capture actual steps if provided, otherwise mark unavailable
        const steps: readonly string[] = reasoningSteps?.length ? reasoningSteps : ["unavailable"];

        // E3: Explainability - only when we have real output
        // P2: Confidence is ONLY populated when the runtime actually provides a real value.
        //     No fabrication, estimation, or hard-coded values.
        const isPython = transformationRef === PYTHON_TRANSFORMATION_REF;
        const explainability = output ? {
            inputSummary: input.substring(0, 200) + (input.length > 200 ? "..." : ""),
            decisionBasis: isPython
                ? "Reasoning engine processed input through AI runtime"
                : "Reasoning engine processed input through the canonical in-process evidence-bound runtime",
            // Confidence: use runtime value only if it is a real number in [0, 1]
            // Otherwise remain undefined and disclose the gap
            ...(typeof runtimeConfidence === "number" && runtimeConfidence >= 0 && runtimeConfidence <= 1
                ? { confidence: runtimeConfidence }
                : {}),
            limitations: this.buildLimitations(output, runtimeConfidence, isPython)
        } : undefined;

        return {
            traceId,
            inputHash,
            outputHash: output ? ProvenanceTrace.hashInput(output) : undefined,
            timestamp,
            verificationStatus,
            sourceRef,
            transformationRef,
            reasoningSteps: steps,
            explainability
        };
    }

    /**
     * Build limitations list, explicitly disclosing missing confidence.
     */
    private buildLimitations(output: string | undefined, runtimeConfidence: number | undefined, isPython: boolean): readonly string[] {
        const limitations: string[] = [];
        if (output) {
            limitations.push(
                isPython
                    ? "AI reasoning confidence bounded by training data"
                    : "Deterministic explanation derived only from verified context values"
            );
        } else {
            limitations.push("No output received from reasoning engine");
        }
        // Explicitly disclose when confidence is unavailable
        if (typeof runtimeConfidence !== "number" || runtimeConfidence < 0 || runtimeConfidence > 1) {
            limitations.push("Confidence score not available from runtime");
        }
        return Object.freeze(limitations);
    }
}
