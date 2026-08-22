import { requiresReevaluation } from "./ReevaluationGate";
describe("Re-evaluation gate", () => {
    it("requires a new evaluation when evidence did not change", () => {
        expect(requiresReevaluation({ beforeEvidence: "A", afterEvidence: "A", executionSucceeded: true })).toBe(true);
    });
    it("does not require another pass after a successful evidence change", () => {
        expect(requiresReevaluation({ beforeEvidence: "A", afterEvidence: "B", executionSucceeded: true })).toBe(false);
    });
});
