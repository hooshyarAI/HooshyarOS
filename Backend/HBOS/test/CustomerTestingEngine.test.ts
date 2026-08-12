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
        const missing = engine.audit(require("node:fs").mkdtempSync(require("node:path").join(process.cwd(), "tmp-customer-test-")));

        expect(missing.ready).toBe(false);
        expect(missing.missingArtifacts).toContain("package.json");
    });
});
