import { SecurityAuditEngine } from "../Engines/SecurityAuditEngine";

describe("Production security evidence", () => {
    it("proves the current repository satisfies the production security artifact contract", () => {
        const result = new SecurityAuditEngine().audit(process.cwd());

        expect(result.secure).toBe(true);
        expect(result.missingArtifacts).toEqual([]);
        expect(result.forbiddenArtifacts).toEqual([]);
    });
});
