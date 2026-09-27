/**
 * Runtime propagation tests for the additive source-trust assessment.
 *
 * Proves the trust lifecycle produced by `Product/TrustAssessment` is exposed
 * as backward-compatible sibling metadata on the important runtime outputs
 * (insights, latest insights, report, dashboard) without mutating the
 * protected ingestion adapter or any frozen model. A blocking data defect must
 * surface as QUARANTINED, never as a healthy result.
 */
import { readFileSync } from "node:fs";
import { Server } from "node:http";
import { resolve } from "node:path";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const XLS_REPORT = resolve(REPO_ROOT, "Backend", "HBOS", "test", "fixtures", "synthetic", "financial_report_1402.xls");

const LEDGER_HEADER = "date,account,debit,credit,currency";
const CLEAN_LEDGER = [
    LEDGER_HEADER,
    "2026-08-01,Cash,0,1000,IRR",
    "2026-08-02,Sales,0,1200,IRR",
    "2026-08-03,Expense,300,0,IRR",
].join("\n");
// An exact duplicate ledger row can double-count; the trust contract must
// quarantine it for review rather than silently trust the source.
const DUPLICATE_LEDGER = [
    LEDGER_HEADER,
    "2026-08-01,Cash,0,1000,IRR",
    "2026-08-01,Cash,0,1000,IRR",
].join("\n");

describe("source-trust assessment — runtime propagation", () => {
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

    const ingest = async (cookie: string, body: unknown): Promise<string> => {
        const response = await jsonPost("/api/ingest", cookie, body);
        expect(response.status).toBe(201);
        return (await response.json()).evidence.sha256;
    };

    test("insights and latest carry a canonical-bound trust assessment", async () => {
        const cookie = await register("trust-ledger", "Trust Org");
        const sha256 = await ingest(cookie, { sourceName: "ledger.csv", format: "CSV", content: CLEAN_LEDGER });

        const insights = await jsonPost("/api/financial/insights", cookie, { sourceSha256: sha256 });
        expect(insights.status).toBe(200);
        const body = await insights.json();
        expect(body.trust).toBeDefined();
        expect(body.trust.state).toBe("CROSS_CHECKED");
        expect(body.trust.canonicalBinding).toBe(true);
        expect(body.trust.source.sha256).toBe(sha256);
        expect(body.trust.blockingFindings).toEqual([]);

        const latest = await request("/api/financial/insights/latest", { headers: { cookie } });
        expect(latest.status).toBe(200);
        const latestBody = await latest.json();
        expect(latestBody.trust).toBeDefined();
        expect(latestBody.trust.source.sha256).toBe(sha256);
    });

    test("an exact duplicate ledger row is quarantined, never trusted", async () => {
        const cookie = await register("trust-dup", "Duplicate Org");
        const sha256 = await ingest(cookie, { sourceName: "ledger.csv", format: "CSV", content: DUPLICATE_LEDGER });

        const insights = await jsonPost("/api/financial/insights", cookie, { sourceSha256: sha256 });
        expect(insights.status).toBe(200);
        const body = await insights.json();
        expect(body.trust.state).toBe("QUARANTINED");
        expect(body.trust.blockingFindings).toContain("duplicate-intra-source");
    });

    test("document source trust flows to analyze, report and dashboard for the same source", async () => {
        const cookie = await register("trust-doc", "Document Org");
        const bytes = readFileSync(XLS_REPORT);
        const sha256 = await ingest(cookie, {
            sourceName: "financial_report_1402.xls",
            format: "XLS",
            contentBase64: bytes.toString("base64"),
        });

        const analysis = await jsonPost("/api/financial/analyze", cookie, { sourceSha256: sha256 });
        expect(analysis.status).toBe(200);

        const dashboard = await request("/api/dashboard", { headers: { cookie } });
        expect(dashboard.status).toBe(200);
        const dashboardBody = await dashboard.json();
        expect(dashboardBody.trust.canonicalBinding).toBe(true);
        expect(dashboardBody.trust.source.sha256).toBe(sha256);

        const report = await request("/api/report", { headers: { cookie } });
        expect(report.status).toBe(200);
        const reportBody = await report.json();
        expect(reportBody.trust.source.sha256).toBe(sha256);
        expect(typeof reportBody.trust.state).toBe("string");

        const assistant = await jsonPost("/api/assistant", cookie, { question: "وضعیت سود چیست؟" });
        expect(assistant.status).toBe(200);
        expect((await assistant.json()).evidence.trust.source.sha256).toBe(sha256);
    });

    test("unknown source yields no fabricated trust metadata", async () => {
        const cookie = await register("trust-missing", "Missing Org");
        const insights = await jsonPost("/api/financial/insights", cookie, { sourceSha256: "a".repeat(64) });
        expect(insights.status).toBe(422);
        expect((await insights.json()).trust).toBeUndefined();
    });
});
