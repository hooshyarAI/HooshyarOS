import { CapabilityEvidenceAudit, EvidenceLevelStatus, behavioralEvidenceSatisfied } from "../Autonomous/Runtime/CapabilityEvidenceAudit";

const completeBase = {
    implementation: true,
    test: true,
    documentation: true,
    dependenciesSatisfied: true,
    verified: true,
};

function level(overrides: Partial<EvidenceLevelStatus> = {}): EvidenceLevelStatus {
    return { present: true, passed: true, fresh: true, ...overrides };
}

describe("CapabilityEvidenceAudit", () => {
    const audit = new CapabilityEvidenceAudit();

    it("does not treat implementation/file existence alone as completion", () => {
        const result = audit.evaluate({
            implementation: true,
            test: false,
            documentation: true,
            dependenciesSatisfied: true,
            verified: false,
        });

        expect(result.complete).toBe(false);
        expect(result.missing).toEqual(["test", "verification"]);
    });

    it("accepts a capability only when all evidence is present", () => {
        const result = audit.evaluate({
            implementation: true,
            test: true,
            documentation: true,
            dependenciesSatisfied: true,
            verified: true,
        });

        expect(result.complete).toBe(true);
        expect(result.missing).toEqual([]);
    });

    describe("completion integrity gate (fail closed)", () => {
        it("fails closed when artifacts/markers exist but behavioral evidence is missing", () => {
            const result = audit.evaluateCompletion({
                capabilityId: "capability.behavior-missing",
                base: completeBase,
                unit: undefined,
                integration: level(),
                application: level(),
                acceptance: level(),
            });

            expect(result.complete).toBe(false);
            expect(result.nonCompleteReasons).toContain("unit-evidence-missing");
        });

        it("fails closed when required application evidence is missing", () => {
            const result = audit.evaluateCompletion({
                capabilityId: "capability.application-missing",
                base: completeBase,
                unit: level(),
                integration: level(),
                application: undefined,
                acceptance: level(),
            });

            expect(result.complete).toBe(false);
            expect(result.nonCompleteReasons).toContain("application-evidence-missing");
        });

        it("fails closed when required acceptance evidence is stale", () => {
            const result = audit.evaluateCompletion({
                capabilityId: "capability.acceptance-stale",
                base: completeBase,
                unit: level(),
                integration: level(),
                application: level(),
                acceptance: level({ fresh: false }),
            });

            expect(result.complete).toBe(false);
            expect(result.nonCompleteReasons).toContain("acceptance-evidence-stale");
        });

        it("fails closed when evidence is present but not behaviorally verified", () => {
            const result = audit.evaluateCompletion({
                capabilityId: "capability.unverified",
                base: completeBase,
                unit: level(),
                integration: level({ passed: false }),
                application: level(),
                acceptance: level(),
            });

            expect(result.complete).toBe(false);
            expect(result.nonCompleteReasons).toContain("integration-evidence-unverified");
        });

        it("never promotes unit+integration-only evidence to completion", () => {
            const result = audit.evaluateCompletion({
                capabilityId: "capability.unit-only",
                base: completeBase,
                unit: level(),
                integration: level(),
            });

            expect(result.complete).toBe(false);
            expect(result.nonCompleteReasons).toEqual(expect.arrayContaining([
                "application-evidence-missing",
                "acceptance-evidence-missing",
            ]));
        });

        it("never reports complete while an external dependency is blocked", () => {
            const result = audit.evaluateCompletion({
                capabilityId: "capability.external-blocked",
                base: completeBase,
                unit: level(),
                integration: level(),
                application: level({ passed: false, blocked: true }),
                acceptance: level({ passed: false, blocked: true }),
                externalBlocked: true,
            });

            expect(result.complete).toBe(false);
            expect(result.nonCompleteReasons).toEqual(expect.arrayContaining([
                "external-dependency-blocked",
                "application-evidence-blocked",
                "acceptance-evidence-blocked",
            ]));
        });

        it("passes only with valid unit/integration/application/acceptance evidence", () => {
            const result = audit.evaluateCompletion({
                capabilityId: "capability.valid",
                base: completeBase,
                unit: level(),
                integration: level(),
                application: level(),
                acceptance: level(),
            });

            expect(result.complete).toBe(true);
            expect(result.nonCompleteReasons).toEqual([]);
        });

        it("fails closed when the base presence gate fails even if all levels pass", () => {
            const result = audit.evaluateCompletion({
                capabilityId: "capability.base-missing",
                base: { ...completeBase, verified: false },
                unit: level(),
                integration: level(),
                application: level(),
                acceptance: level(),
            });

            expect(result.complete).toBe(false);
            expect(result.nonCompleteReasons).toContain("base-verification-missing");
        });
    });

    describe("behavioral evidence contract", () => {
        it("rejects a test that does not reference the implementation behavior", () => {
            expect(behavioralEvidenceSatisfied("export class E { registerUser() {} }", "expect(true).toBe(true);")).toBe(false);
        });

        it("rejects a test with no assertions", () => {
            expect(behavioralEvidenceSatisfied("export class E { registerUser() {} }", "describe('E', () => {});")).toBe(false);
        });

        it("accepts a test that exercises a method the implementation defines", () => {
            expect(behavioralEvidenceSatisfied(
                "export class E { registerUser() { return true; } }",
                "expect(new E().registerUser()).toBeTruthy();"
            )).toBe(true);
        });

        it("accepts a governed explicit behavior marker present in both implementation and test", () => {
            expect(behavioralEvidenceSatisfied(
                "export class E { route() {} }",
                "expect(engine.route()).toBeDefined();",
                ["route"]
            )).toBe(true);
        });
    });
});
