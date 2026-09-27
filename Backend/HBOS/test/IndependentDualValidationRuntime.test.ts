/**
 * Runtime propagation tests for two-path independent validation.
 *
 * Proves the runtime exposes the independent-validation result as additive
 * metadata on the insights and report surfaces, built from the existing
 * canonical calculation (PATH A) and the existing accounting-identity control
 * (PATH B). A subject whose independent path cannot run must be reported
 * NOT_TESTABLE, never as agreement.
 */
import { readFileSync } from "node:fs";
import { Server } from "node:http";
import { resolve } from "node:path";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const XLS_REPORT = resolve(REPO_ROOT, "Backend", "HBOS", "test", "fixtures", "synthetic", "financial_report_1402.xls");

const VALID_STATUSES = ["AGREEMENT", "DISAGREEMENT", "NOT_TESTABLE"];

describe("independent dual validation — runtime propagation", () => {
    let server: Server;
    let clock: number;

    beforeEach(async () => {
        clock = 1_900_000_000_000;
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            now: () => clock,
            sessionSweepIntervalMs: 0,
            reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified" }) },
        });
        await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", () => resolveListen()));
    });

    afterEach(async () => {
        await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    });

    const request = async (path: string, options: RequestInit = {}): Promise<Response> => {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("server-not-listening");
        return fetch(`http://127.0.0.1:${address.port}${path}`, options);
    };

    const jsonPost = (path: string, cookie: string, body: unknown) => {
        clock += 1000;
        return request(path, {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify(body),
        });
    };

    const register = async (username: string, organization: string): Promise<string> => {
        const response = await request("/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
        });
        const cookie = response.headers.get("set-cookie");
        if (!cookie) throw new Error("session-cookie-missing");
        return cookie.split(";")[0];
    };

    const ingestReport = async (cookie: string): Promise<string> => {
        const bytes = readFileSync(XLS_REPORT);
        const response = await jsonPost("/api/ingest", cookie, {
            sourceName: "financial_report_1402.xls",
            format: "XLS",
            contentBase64: bytes.toString("base64"),
        });
        expect(response.status).toBe(201);
        return (await response.json()).evidence.sha256;
    };

    test("insights expose dual-validation outcomes and an honest summary", async () => {
        const cookie = await register("dual-insights", "Dual Org");
        const sha256 = await ingestReport(cookie);

        const insights = await jsonPost("/api/financial/insights", cookie, { sourceSha256: sha256 });
        expect(insights.status).toBe(200);
        const body = await insights.json();
        expect(body.dualValidation).toBeDefined();
        expect(Array.isArray(body.dualValidation.outcomes)).toBe(true);
        expect(body.dualValidation.outcomes).toHaveLength(4);
        for (const outcome of body.dualValidation.outcomes) {
            expect(VALID_STATUSES).toContain(outcome.status);
            expect(outcome.pathA.method).toBe("canonical-calculation");
            expect(outcome.pathB.method).toBe("reconciliation-identity");
            expect(typeof outcome.scope).toBe("string");
        }
        const summary = body.dualValidation.summary;
        expect(summary.total).toBe(4);
        expect(summary.agreements + summary.disagreements + summary.notTestable).toBe(4);
    });

    test("a subject without an independent control is NOT_TESTABLE, not a confirmation", async () => {
        const cookie = await register("dual-not-testable", "Dual Org");
        const sha256 = await ingestReport(cookie);

        const insights = await jsonPost("/api/financial/insights", cookie, { sourceSha256: sha256 });
        const body = await insights.json();
        const notTestable = body.dualValidation.outcomes.filter(
            (outcome: { status: string }) => outcome.status === "NOT_TESTABLE",
        );
        expect(notTestable.length).toBeGreaterThan(0);
        for (const outcome of notTestable) {
            expect(outcome.requiredReview).toBe(true);
            expect(outcome.confidenceLimitation.length).toBeGreaterThan(0);
        }
        // Missing independent evidence must never be counted as confirmation.
        expect(body.dualValidation.summary.allConfirmed).toBe(false);
    });

    test("latest insights and report carry the same dual-validation metadata", async () => {
        const cookie = await register("dual-report", "Dual Org");
        const sha256 = await ingestReport(cookie);

        const insights = await jsonPost("/api/financial/insights", cookie, { sourceSha256: sha256 });
        expect(insights.status).toBe(200);

        const analysis = await jsonPost("/api/financial/analyze", cookie, { sourceSha256: sha256 });
        expect(analysis.status).toBe(200);

        const latest = await request("/api/financial/insights/latest", { headers: { cookie } });
        expect(latest.status).toBe(200);
        expect((await latest.json()).dualValidation.outcomes).toHaveLength(4);

        const report = await request("/api/report", { headers: { cookie } });
        expect(report.status).toBe(200);
        const reportBody = await report.json();
        expect(reportBody.dualValidation.outcomes).toHaveLength(4);
        // The report is a flat list of Persian lines; independent validation must
        // be present as at least one truthful per-subject line.
        const reportLines = (reportBody.sections || []).join("\n");
        expect(reportLines).toMatch(/هر دو مسیر مستقل هم‌خوان‌اند|مسیر کاننیکال و کنترل مستقل|مسیر دوم مستقل برای این قلم قابل آزمون نیست/);
    });
});
