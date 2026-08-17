import { RiskPriorityEngine } from "./RiskPriorityEngine";
import { RiskAssessment } from "./RiskAssessment";

describe("RiskPriorityEngine", () => {
    const engine = new RiskPriorityEngine();

    it("blocks critical and prevents high-risk execution", () => {
        expect(engine.prioritize({ id: "critical", score: 25, level: "CRITICAL" })).toEqual({
            id: "critical", action: "BLOCK", executionAllowed: false,
        });
        expect(engine.prioritize({ id: "high", score: 12, level: "HIGH" })).toEqual({
            id: "high", action: "FIX_BEFORE_NEXT_WAVE", executionAllowed: false,
        });
    });

    it("plans medium, monitors low, and fails closed on insufficient evidence", () => {
        expect(engine.prioritize({ id: "medium", score: 6, level: "MEDIUM" })).toEqual({
            id: "medium", action: "PLAN", executionAllowed: true,
        });
        expect(engine.prioritize({ id: "low", score: 1, level: "LOW" })).toEqual({
            id: "low", action: "MONITOR", executionAllowed: true,
        });
        expect(engine.prioritize({ id: "unknown", score: 0, level: "INSUFFICIENT_EVIDENCE" })).toEqual({
            id: "unknown", action: "BLOCK", executionAllowed: false,
        });
    });
});
