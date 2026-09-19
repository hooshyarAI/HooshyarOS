import { Server } from "node:http";
import { createHash } from "node:crypto";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const request = async (server: Server, path: string, options: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

const cookieFrom = (response: Response): string => {
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("session-cookie-missing");
    return cookie.split(";")[0];
};

const CSV = [
    "date,account,debit,credit,currency",
    "2026-08-01,Cash,0,1000,IRR",
    "2026-08-02,Sales,0,1500,IRR",
    "2026-08-03,Expense,300,0,IRR",
    "2026-08-04,Receivable,0,800,IRR",
].join("\n");

describe("product.reports-export — commercial runtime path", () => {
    let server: Server;
    let clock: number;

    beforeEach(async () => {
        clock = 1_900_000_000_000;
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            now: () => clock,
            reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified" }) },
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const register = (username: string, organization: string) =>
        request(server, "/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
        });

    const createAnalysis = async (cookie: string) => {
        clock += 1000;
        const analysis = await request(server, "/api/analyze", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ csv: CSV, sourceName: "ledger.csv", assets: 10000, liabilities: 2500 }),
        });
        expect(analysis.status).toBe(200);
        return analysis;
    };

    const exportReport = async (cookie: string, format: string) => {
        clock += 1000;
        return request(server, "/api/report/export", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ format }),
        });
    };

    test("generates a real XLSX artifact, persists it, and downloads intact bytes", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);
        await createAnalysis(cookie);

        const exported = await exportReport(cookie, "XLSX");
        expect(exported.status).toBe(201);
        const body = await exported.json();
        expect(body.status).toBe("READY");
        expect(body.capabilityId).toBe("product.reports-export");
        expect(body.targetEngine).toBe("Reports Engine");
        expect(body.artifact.format).toBe("XLSX");
        expect(body.artifact.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        expect(body.artifact.byteLength).toBeGreaterThan(1000);
        expect(body.artifact.sha256).toHaveLength(64);
        expect(body.artifact.provenance.verificationStatus).toBe("VERIFIED");
        expect(body.artifact.provenance.transformationRef).toBe("reports-engine:XLSX");
        expect(body.downloadUrl).toBe(`/api/report/artifacts/${body.artifact.artifactId}/download`);

        const download = await request(server, body.downloadUrl, { headers: { cookie } });
        expect(download.status).toBe(200);
        expect(download.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        expect(download.headers.get("content-disposition")).toBe(`attachment; filename="${body.artifact.fileName}"`);
        expect(download.headers.get("x-artifact-sha256")).toBe(body.artifact.sha256);
        const bytes = Buffer.from(await download.arrayBuffer());
        expect(bytes.length).toBe(body.artifact.byteLength);
        expect(bytes[0]).toBe(0x50);
        expect(bytes[1]).toBe(0x4b);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(body.artifact.sha256);

        const list = await request(server, "/api/report/artifacts", { headers: { cookie } });
        expect(list.status).toBe(200);
        const listBody = await list.json();
        expect(listBody.artifacts).toHaveLength(1);
        expect(listBody.artifacts[0].artifactId).toBe(body.artifact.artifactId);
    });

    test("serves TXT, CSV and JSON with correct content types and parseable content", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);
        await createAnalysis(cookie);

        const txt = await exportReport(cookie, "TXT");
        expect(txt.status).toBe(201);
        const txtBody = await txt.json();
        const txtDownload = await request(server, txtBody.downloadUrl, { headers: { cookie } });
        expect(txtDownload.headers.get("content-type")).toBe("text/plain; charset=utf-8");
        expect(await txtDownload.text()).toContain("Tenant:");

        const csv = await exportReport(cookie, "CSV");
        expect(csv.status).toBe(201);
        const csvBody = await csv.json();
        const csvDownload = await request(server, csvBody.downloadUrl, { headers: { cookie } });
        expect(csvDownload.headers.get("content-type")).toBe("text/csv; charset=utf-8");
        expect((await csvDownload.text()).trim().split("\r\n")[0]).toBe('"Section","Entry"');

        const json = await exportReport(cookie, "JSON");
        expect(json.status).toBe(201);
        const jsonBody = await json.json();
        const jsonDownload = await request(server, jsonBody.downloadUrl, { headers: { cookie } });
        expect(jsonDownload.headers.get("content-type")).toBe("application/json; charset=utf-8");
        const parsed = JSON.parse(await jsonDownload.text());
        expect(parsed.tenantId).toBe(jsonBody.tenantId);
        expect(Array.isArray(parsed.sections)).toBe(true);
    });

    test("keeps artifacts tenant-scoped and denies cross-tenant download", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);
        await createAnalysis(cookie);
        const exported = await exportReport(cookie, "CSV");
        const body = await exported.json();

        const other = await register("other-owner", "Other");
        const otherCookie = cookieFrom(other);
        const leak = await request(server, body.downloadUrl, { headers: { cookie: otherCookie } });
        expect(leak.status).toBe(404);
        expect((await leak.json()).error).toBe("REPORT_ARTIFACT_NOT_FOUND");

        const otherList = await request(server, "/api/report/artifacts", { headers: { cookie: otherCookie } });
        expect(otherList.status).toBe(200);
        expect((await otherList.json()).artifacts).toEqual([]);
    });

    test("denies unauthenticated export and download", async () => {
        const anonymousExport = await request(server, "/api/report/export", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ format: "TXT" }),
        });
        expect(anonymousExport.status).toBe(401);

        const anonymousDownload = await request(server, "/api/report/artifacts/report-deadbeef/download");
        expect(anonymousDownload.status).toBe(401);
    });

    test("fails closed on unsupported formats, missing analysis and unknown artifacts", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const noAnalysis = await exportReport(cookie, "TXT");
        expect(noAnalysis.status).toBe(422);
        expect((await noAnalysis.json()).error).toBe("REPORT_ANALYSIS_REQUIRED");

        await createAnalysis(cookie);
        const unsupported = await exportReport(cookie, "PDF");
        expect(unsupported.status).toBe(400);
        expect((await unsupported.json()).error).toBe("REPORT_FORMAT_UNSUPPORTED");

        const missing = await request(server, "/api/report/artifacts/report-00000000000000000000000000000000/download", { headers: { cookie } });
        expect(missing.status).toBe(404);
        expect((await missing.json()).error).toBe("REPORT_ARTIFACT_NOT_FOUND");
    });
});
