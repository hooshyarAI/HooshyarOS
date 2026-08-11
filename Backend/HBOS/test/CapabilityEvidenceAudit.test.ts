import { CapabilityEvidenceAudit } from "../Autonomous/Runtime/CapabilityEvidenceAudit";

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
});
