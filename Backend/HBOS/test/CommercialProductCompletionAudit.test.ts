import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("CommercialProductCompletionAudit", () => {
    it("requires the canonical commercial completion contract", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());
        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });

    it("requires a canonical runnable web product entrypoint", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());
        expect(result.missingLayers).not.toContain("web-entrypoint");
    });
});
