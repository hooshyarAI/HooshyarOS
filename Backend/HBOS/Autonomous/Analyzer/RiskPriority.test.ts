import { prioritizeRisk } from "./RiskPriority";

describe("Risk priority", () => {
    it("maps verified severity to an operational action", () => {
        expect(prioritizeRisk({ id: "critical", score: 25, level: "CRITICAL" })).toEqual({ id: "critical", action: "BLOCK" });
        expect(prioritizeRisk({ id: "high", score: 12, level: "HIGH" })).toEqual({ id: "high", action: "FIX_BEFORE_NEXT_WAVE" });
        expect(prioritizeRisk({ id: "medium", score: 6, level: "MEDIUM" })).toEqual({ id: "medium", action: "PLAN" });
        expect(prioritizeRisk({ id: "low", score: 1, level: "LOW" })).toEqual({ id: "low", action: "MONITOR" });
    });

    it("requires more evidence when risk severity is not established", () => {
        expect(prioritizeRisk({ id: "unknown", score: 0, level: "INSUFFICIENT_EVIDENCE" })).toEqual({
            id: "unknown", action: "COLLECT_EVIDENCE",
        });
    });
});
