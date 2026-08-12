import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("CommercialProductCompletionAudit", () => {
    it("requires the canonical commercial completion contract", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });

    it("recognizes the implemented organization identity and tenant persistence boundaries", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.complete).toBe(false);
        expect(result.missingLayers).not.toContain("persistence-boundary");
        expect(result.missingLayers).not.toContain("authentication-authorization-boundary");
        expect(result.missingLayers.some(layer => layer.startsWith("roadmap:"))).toBe(true);
    });

    it("reports a missing commercial roadmap artifact instead of claiming completion", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.complete).toBe(false);
        expect(result.missingLayers.some(layer => layer.startsWith("roadmap:"))).toBe(true);
    });
});
