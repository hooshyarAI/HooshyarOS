import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("CommercialProductCompletionAudit", () => {
    it("requires the canonical commercial completion contract", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });

    it("recognizes the canonical web product entrypoint independently of engine artifacts", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.complete).toBe(false);
        expect(result.missingLayers).not.toContain("web-entrypoint");
    });
});
