import { Engine } from "../Core/Engine";

export interface BudgetAnalysisInput { planned: number; actual: number; }
export interface BudgetAnalysisResult { planned: number; actual: number; variance: number; utilization: number; status: "READY" | "BLOCKED"; }

export class BudgetIntelligenceEngine implements Engine {
    name = "BudgetIntelligenceEngine";
    initialize(): void {}
    health(): boolean { return true; }
    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return { id: "platform.budget-intelligence", capability: "implement Budget Intelligence", targetEngine: "Budget Intelligence Engine" };
    }
    analyze(input: BudgetAnalysisInput): BudgetAnalysisResult {
        if (!Number.isFinite(input?.planned) || !Number.isFinite(input?.actual) || input.planned < 0 || input.actual < 0) {
            return { planned: 0, actual: 0, variance: 0, utilization: 0, status: "BLOCKED" };
        }
        return {
            planned: input.planned,
            actual: input.actual,
            variance: input.actual - input.planned,
            utilization: input.planned === 0 ? 0 : input.actual / input.planned,
            status: "READY"
        };
    }

    // Canonical evidence-compatible alias. The capability contract owns one
    // deterministic analysis operation; callers do not need a second budget
    // calculation implementation.
    analyzeBudget(input: BudgetAnalysisInput): BudgetAnalysisResult {
        return this.analyze(input);
    }
}
