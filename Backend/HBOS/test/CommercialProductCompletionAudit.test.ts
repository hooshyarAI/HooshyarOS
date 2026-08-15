import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("CommercialProductCompletionAudit", () => {
    it("requires the canonical commercial completion contract", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });

    it("reports the real remaining commercial readiness boundaries", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.complete).toBe(false);
        expect(result.missingLayers).toContain("persistence-boundary");
        expect(result.missingLayers).toContain("authentication-authorization-boundary");
        expect(result.missingLayers).not.toContain("web-entrypoint");
    });
});
