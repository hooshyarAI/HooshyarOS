import { selectRiskAction } from "./RiskActionOrchestrator";

const risk = (level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT_EVIDENCE") => ({ level } as any);

describe("Risk action orchestrator", () => {
    it("blocks critical risk", () => expect(selectRiskAction(risk("CRITICAL"))).toEqual({ action: "BLOCK", executable: false }));
    it("requires evidence when evidence is insufficient", () => expect(selectRiskAction(risk("INSUFFICIENT_EVIDENCE"))).toEqual({ action: "COLLECT_EVIDENCE", executable: false }));
    it("plans medium risk", () => expect(selectRiskAction(risk("MEDIUM"))).toEqual({ action: "PLAN", executable: true }));
});
