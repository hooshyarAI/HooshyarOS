import { calculateRisk } from "./AutonomousRiskEngine";
describe("Autonomous risk engine", () => {
    it("classifies critical risk", () => {
        expect(calculateRisk({ probability: 100, impact: 100 }).level).toBe("CRITICAL");
    });
    it("classifies low risk", () => {
        expect(calculateRisk({ probability: 10, impact: 10 }).level).toBe("LOW");
    });
});
