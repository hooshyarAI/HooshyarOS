import { evaluateAutonomousCycle } from "./AutonomousCycleOrchestrator";

describe("Autonomous cycle orchestrator", () => {
    const base = {
        risk: { probability: 10, impact: 10 },
        dependencies: { capability: "A", dependencies: ["B"], verified: ["B"] },
        authorization: { evidenceVerified: true, dependenciesSatisfied: true, testsDefined: true, rollbackReady: true },
        verification: { behavioral: true, integration: true, adversarial: true },
        commercial: { security: true, persistence: true, ingestion: true, tenantIsolation: true, verification: true },
        privacy: { authorized: true, tenantMatches: true, encrypted: true },
        lineage: { source: "input", transformations: ["normalize"], destination: "db" },
        trial: { commercialReady: true, scopeDefined: true, slaDefined: true, dataBoundaryVerified: true },
    };

    it("composes all gates into an executable verified cycle", () => {
        expect(evaluateAutonomousCycle(base)).toEqual({ riskLevel: "LOW", executable: true, trialAllowed: true });
    });

    it("fails closed when customer data boundary is broken", () => {
        expect(evaluateAutonomousCycle({ ...base, privacy: { authorized: true, tenantMatches: false, encrypted: true } }).executable).toBe(false);
    });
});
