import { Engine } from "../Core/Engine";

export interface RiskInitializationResult { status: "READY"; }
export interface RiskAssessmentResult { probability: number; impact: number; score: number; status: "READY" | "BLOCKED"; }

/**
 * 09-1.7 1-D sensitivity result for a single input variable.
 * `deltaPct` is the fractional perturbation (e.g. -0.10 = -10%).
 */
export interface SensitivityEntry {
    variable: string;
    deltaPct: number;
    baseValue: number;
    newValue: number;
    baseOutput: number;
    newOutput: number;
    absoluteChange: number;
    elasticOutput: number;
}

export interface SensitivityResult {
    baseOutput: number;
    entries: SensitivityEntry[];
    status: "READY" | "BLOCKED";
}

export class RiskIntelligenceEngine implements Engine {
    name = "RiskIntelligenceEngine";

    initialize(): RiskInitializationResult {
        return { status: "READY" };
    }

    health(): boolean { return true; }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return { id: "platform.risk-intelligence", capability: "implement Risk Intelligence", targetEngine: "Risk Intelligence Engine" };
    }

    assess(probability: number, impact: number): RiskAssessmentResult {
        if (!Number.isFinite(probability) || !Number.isFinite(impact) || probability < 0 || probability > 1 || impact < 0) {
            return { probability: 0, impact: 0, score: 0, status: "BLOCKED" };
        }
        return { probability, impact, score: probability * impact, status: "READY" };
    }

    /**
     * 09-1.7 One-dimensional sensitivity analysis.
     *
     * Perturbs each named input by each deltaPct (e.g. -0.20, -0.10, +0.10, +0.20)
     * and re-evaluates the model function. Returns base output and per-entry
     * absolute + elastic change.
     *
     * The model is supplied as a pure function. The engine does NOT execute
     * user code with side effects; the function is called only with the
     * provided numeric values.
     */
    sensitivity(input: {
        base: Readonly<Record<string, number>>;
        deltas: readonly number[];
        model: (params: Readonly<Record<string, number>>) => number;
    }): SensitivityResult {
        if (!input || !input.base || !Array.isArray(input.deltas) || typeof input.model !== "function") {
            return { baseOutput: 0, entries: [], status: "BLOCKED" };
        }
        for (const v of Object.values(input.base)) {
            if (!Number.isFinite(v)) {
                return { baseOutput: 0, entries: [], status: "BLOCKED" };
            }
        }
        const baseOutput = input.model(input.base);
        if (!Number.isFinite(baseOutput)) {
            return { baseOutput: 0, entries: [], status: "BLOCKED" };
        }
        const entries: SensitivityEntry[] = [];
        for (const variable of Object.keys(input.base)) {
            const baseVal = input.base[variable];
            for (const deltaPct of input.deltas) {
                if (!Number.isFinite(deltaPct)) continue;
                const newVal = baseVal * (1 + deltaPct);
                if (!Number.isFinite(newVal)) continue;
                const perturbed: Record<string, number> = { ...input.base, [variable]: newVal };
                const newOutput = input.model(perturbed);
                if (!Number.isFinite(newOutput)) continue;
                const absChange = newOutput - baseOutput;
                const elastic = baseOutput === 0 ? 0 : (absChange / baseOutput) / deltaPct;
                entries.push({
                    variable,
                    deltaPct,
                    baseValue: baseVal,
                    newValue: newVal,
                    baseOutput,
                    newOutput,
                    absoluteChange: absChange,
                    elasticOutput: elastic
                });
            }
        }
        return { baseOutput, entries, status: "READY" };
    }

    /**
     * 09-1.7 N-D (multi-variable) tornado.
     * For each variable, evaluates the model at base, base-up, and base-down
     * and reports the resulting output range. Sorts by descending range.
     */
    tornado(input: {
        base: Readonly<Record<string, number>>;
        deltaPct: number;
        model: (params: Readonly<Record<string, number>>) => number;
    }): { baseOutput: number; variable: string; downOutput: number; upOutput: number; range: number }[] {
        if (!input || !input.base || typeof input.model !== "function" ||
            !Number.isFinite(input.deltaPct)) {
            return [];
        }
        const baseOutput = input.model(input.base);
        if (!Number.isFinite(baseOutput)) return [];
        const result: { baseOutput: number; variable: string; downOutput: number; upOutput: number; range: number }[] = [];
        for (const variable of Object.keys(input.base)) {
            const baseVal = input.base[variable];
            const down: Record<string, number> = { ...input.base, [variable]: baseVal * (1 - input.deltaPct) };
            const up: Record<string, number> = { ...input.base, [variable]: baseVal * (1 + input.deltaPct) };
            const dOut = input.model(down);
            const uOut = input.model(up);
            if (!Number.isFinite(dOut) || !Number.isFinite(uOut)) continue;
            result.push({ baseOutput, variable, downOutput: dOut, upOutput: uOut, range: Math.abs(uOut - dOut) });
        }
        result.sort((a, b) => b.range - a.range);
        return result;
    }
}
