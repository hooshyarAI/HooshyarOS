import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { CommercialProductCompletionAudit } from "../Autonomous/Runtime/CommercialProductCompletionAudit";

type JestSuiteResult = { name?: string; status?: string };
type JestJson = { testResults?: JestSuiteResult[] };

const RESULT_FILE = process.env.COMMERCIAL_JEST_RESULT_FILE ?? join(process.cwd(), "artifacts/commercial-jest-results.json");

function normalize(p: string): string {
    const absolute = resolve(p);
    const relative = absolute.startsWith(process.cwd()) ? absolute.slice(process.cwd().length + 1) : p;
    return relative.replace(/\\/g, "/");
}

describe("CommercialProductCompletionAudit re-audit bridge", () => {
    it("feeds actual full-Jest suite provenance into the commercial audit", () => {
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
        expect(failedSuites).toEqual([]);
        expect(result.contractPresent).toBe(true);

        console.log(JSON.stringify({
            commercialAudit: result,
            jestSuites: testResults.length,
            failedSuites,
        }, null, 2));
    });
});
