import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("CommercialProductCompletionAudit", () => {
    it("requires the canonical commercial completion contract", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });

    it("does not equate engine artifacts with a usable web product", () => {
        const audit = new CommercialProductCompletionAudit();
        const result = audit.audit(process.cwd());

        expect(result.complete).toBe(false);
        expect(result.missingLayers).toContain("web-entrypoint");
        expect(result.missingLayers).toContain("persistence-boundary");
    });
});
