import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

type JestSuiteResult = { name?: string; status?: string };
type JestJson = { testResults?: JestSuiteResult[] };

const RESULT_FILE = process.env.COMMERCIAL_JEST_RESULT_FILE ?? join(process.cwd(), "artifacts/commercial-jest-results.json");
const VERDICT_FILE = process.env.COMMERCIAL_VERDICT_FILE ?? join(process.cwd(), "artifacts/commercial-product-verdict.json");

function normalize(p: string): string {
    const absolute = resolve(p);
    const relative = absolute.startsWith(process.cwd()) ? absolute.slice(process.cwd().length + 1) : p;
    return relative.replace(/\\/g, "/");
}

describe("CommercialProductCompletionAudit re-audit bridge", () => {
    it("feeds actual full-Jest suite provenance into the commercial audit and enforces the verdict", () => {
        expect(existsSync(RESULT_FILE)).toBe(true);
        const report = JSON.parse(readFileSync(RESULT_FILE, "utf8")) as JestJson;
        const testResults = (report.testResults ?? [])
            .filter((suite): suite is Required<Pick<JestSuiteResult, "name" | "status">> => Boolean(suite.name && suite.status))
            .map(suite => ({ path: normalize(suite.name), passed: suite.status === "passed" }));

        expect(testResults.length).toBeGreaterThan(0);

        const result = new CommercialProductCompletionAudit().audit(process.cwd(), {
            verified: true,
            fullVerify: true,
            focusedTest: null,
            executedTests: testResults.map(test => test.path),
            testResults,
        });

        const failedSuites = testResults.filter(test => !test.passed).map(test => test.path);
        const verdict = {
            schemaVersion: 1,
            commercialAudit: result,
            jestSuites: testResults.length,
            failedSuites,
            allLayersVerified: result.layers.length === 16 && result.layers.every(layer => layer.status === "VERIFIED"),
        };

        mkdirSync(join(process.cwd(), "artifacts"), { recursive: true });
        writeFileSync(VERDICT_FILE, JSON.stringify(verdict, null, 2) + "\n", "utf8");

        expect(failedSuites).toEqual([]);
        expect(result.contractPresent).toBe(true);
        expect(verdict.allLayersVerified).toBe(true);
        expect(result.completionStates.commercialProductRuntimeComplete).toBe(true);
        expect(result.completionStates.productComplete).toBe(true);
    });
});
