import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { CustomerTestingEngine } from "../Engines/CustomerTestingEngine";

describe("CustomerTestingEngine", () => {
    it("reports readiness when governed customer-testing evidence exists", () => {
        const engine = new CustomerTestingEngine();

        expect(engine.health()).toBe(true);
        const result = engine.audit(process.cwd());

        expect(result.ready).toBe(true);
        expect(result.missingArtifacts).toEqual([]);
    });

    it("reports missing customer-testing evidence deterministically", () => {
        const engine = new CustomerTestingEngine();
        const root = mkdtempSync(join(process.cwd(), "tmp-customer-test-"));

        try {
            const result = engine.audit(root);
            expect(result.ready).toBe(false);
            expect(result.missingArtifacts).toContain("package.json");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
