const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const ACCEPTANCE_SCRIPT_PATH = path.join(ROOT, "scripts", "web-product-acceptance.cjs");
const RUNTIME_PATH = path.join(ROOT, "Backend", "HBOS", "Autonomous", "Runtime", "CommercialRuntimeServer.ts");
const RUNTIME_TEST_PATH = path.join(ROOT, "Backend", "HBOS", "Autonomous", "Runtime", "CommercialRuntimeServer.test.ts");

describe("web product acceptance CI repair regression", () => {
    test("acceptance script asserts the Persian-first analytics section and the analytics report error code", () => {
        const script = fs.readFileSync(ACCEPTANCE_SCRIPT_PATH, "utf8");
        expect(script).toContain("WEB_ACCEPTANCE_ANALYTICS_REPORT_FAILED");
        expect(script).toContain("section.includes('تحلیل تکمیلی')");
    });

    test("runtime composes the Persian-first analytics section and never leaks the English label", () => {
        const runtime = fs.readFileSync(RUNTIME_PATH, "utf8");
        expect(runtime).toContain('heading: "تحلیل تکمیلی"');
        expect(runtime).not.toMatch(/heading:\s*"Financial analytics:/);
    });

    test("runtime regression test pins the Persian-first report contract", () => {
        const test = fs.readFileSync(RUNTIME_TEST_PATH, "utf8");
        expect(test).toContain('section.includes("تحلیل تکمیلی")');
        expect(test).toContain('section.includes("Financial analytics:"))).toBe(false)');
    });
});