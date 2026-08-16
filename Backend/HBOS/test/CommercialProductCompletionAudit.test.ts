import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

describe("CommercialProductCompletionAudit", () => {
    it("requires the canonical commercial completion contract", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());
        expect(result.contractPresent).toBe(true);
        expect(result.missingLayers).not.toContain("commercial-completion-contract");
    });
    it("recognizes the canonical web runtime while keeping incomplete commercial layers explicit", () => {
        const result = new CommercialProductCompletionAudit().audit(process.cwd());
        expect(result.complete).toBe(false);
        expect(result.missingLayers).not.toContain("web-entrypoint");
        expect(result.missingLayers).toEqual(expect.arrayContaining(["persistence-boundary", "authentication-authorization-boundary"]));
    });
});
