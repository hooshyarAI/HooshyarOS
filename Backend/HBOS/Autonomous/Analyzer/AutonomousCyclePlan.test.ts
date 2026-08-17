import { createAutonomousCyclePlan } from "./AutonomousCyclePlan";

describe("Autonomous cycle planning gate", () => {
    const complete = {
        capability: "Customer Data Isolation",
        priority: "P0" as const,
        blockers: [],
        dependenciesSatisfied: true,
        evidenceVerified: true,
        requiredTestsDefined: true,
    };

    it("allows execution only when all preconditions are satisfied", () => {
        expect(createAutonomousCyclePlan(complete)).toEqual({
            capability: "Customer Data Isolation",
            decision: "EXECUTE",
            reasons: [],
        });
    });

    it("blocks even P0 work when evidence is not verified", () => {
        const result = createAutonomousCyclePlan({ ...complete, evidenceVerified: false });
        expect(result.decision).toBe("BLOCK");
        expect(result.reasons).toContain("REQUIRED_EVIDENCE_NOT_VERIFIED");
    });

    it("blocks when dependencies or tests are incomplete", () => {
        const result = createAutonomousCyclePlan({
            ...complete,
            dependenciesSatisfied: false,
            requiredTestsDefined: false,
        });
        expect(result.decision).toBe("BLOCK");
        expect(result.reasons).toEqual(
            expect.arrayContaining(["DEPENDENCIES_NOT_SATISFIED", "REQUIRED_TESTS_NOT_DEFINED"]),
        );
    });
});
