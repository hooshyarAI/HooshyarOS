import { Server } from "node:http";
import ExcelJS from "exceljs-hardened";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialIngestionService } from "../Product/FinancialIngestionService";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const CSV = "date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-01,Sales,0,1000,IRR\n2026-08-02,Receivable,250,0,IRR\n2026-08-02,Sales,0,250,IRR";

const TXT = "date,account,debit,credit,currency\n2026-08-03,Expense,300,0,IRR\n2026-08-03,Revenue,0,300,IRR";

const STRUCTURED = JSON.stringify({
    transactions: [
        { date: "2026-08-01", account: "Cash", debit: 1000, credit: 0, currency: "IRR" },
        { date: "2026-08-01", account: "Sales", debit: 0, credit: 1000, currency: "IRR" },
    ],
});

async function createXlsxBytes(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Transactions");
    worksheet.addRow(["date", "account", "debit", "credit", "currency"]);
    worksheet.addRow(["2026-08-01", "Cash", 1000, 0, "IRR"]);
    worksheet.addRow(["2026-08-01", "Sales", 0, 1000, "IRR"]);
    const data = await workbook.xlsx.writeBuffer();
    return Buffer.from(data as ArrayBuffer);
}

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

describe("Phase 14-1.1 — canonical multi-format ingestion service", () => {
    test("ingests CSV, STRUCTURED, TXT and XLSX with truthful provenance", async () => {
        const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
        const service = new FinancialIngestionService(persistence);

        const csv = await service.ingest("tenant-a", { sourceName: "ledger.csv", format: "CSV", content: CSV });
        expect(csv.result.evidence.sourceType).toBe("CSV");
        expect(csv.result.model.totals).toEqual({ debit: 1250, credit: 1250, balance: 0 });
        expect(csv.rawSourceRef.persisted).toBe(true);

        const structured = await service.ingest("tenant-a", { sourceName: "ledger.json", format: "STRUCTURED", content: STRUCTURED });
        expect(structured.result.evidence.sourceType).toBe("STRUCTURED");
        expect(structured.result.model.transactions).toHaveLength(2);

        const txt = await service.ingest("tenant-a", { sourceName: "ledger.txt", format: "TXT", content: TXT });
        expect(txt.result.model.transactions).toHaveLength(2);
        expect(txt.encoding).toBe("UTF-8");

        const xlsxBytes = await createXlsxBytes();
        const xlsx = await service.ingest("tenant-a", { sourceName: "ledger.xlsx", format: "XLSX", contentBase64: xlsxBytes.toString("base64") });
        expect(xlsx.result.evidence.sourceType).toBe("XLSX");
        expect(xlsx.result.model.transactions).toHaveLength(2);
        // Raw evidence SHA is computed from the original XLSX bytes.
        expect(xlsx.rawSourceRef.sha256).toHaveLength(64);

        persistence.close();
    });

    test("persists raw source evidence and keeps it tenant-scoped", async () => {
        const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
        const service = new FinancialIngestionService(persistence);

        const outcome = await service.ingest("tenant-a", { sourceName: "ledger.csv", format: "CSV", content: CSV });

        const listA = await service.listSources("tenant-a");
        expect(listA).toHaveLength(1);
        expect(listA[0].sha256).toBe(outcome.rawSourceRef.sha256);

        const evidence = await service.readSource("tenant-a", outcome.rawSourceRef.sha256);
        expect(evidence).not.toBeNull();
        expect(evidence?.content).toContain("date,account,debit,credit,currency");

        // Another tenant cannot list or read tenant-a's raw evidence.
        expect(await service.listSources("tenant-b")).toHaveLength(0);
        expect(await service.readSource("tenant-b", outcome.rawSourceRef.sha256)).toBeNull();

        persistence.close();
    });

    test("fails closed on malformed input and does not persist a model", async () => {
        const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
        const service = new FinancialIngestionService(persistence);

        const doubleSided = "date,account,debit,credit,currency\n2026-08-01,Cash,100,50,IRR";
        await expect(service.ingest("tenant-a", { sourceName: "bad.csv", format: "CSV", content: doubleSided }))
            .rejects.toThrow("ingestion-double-sided-row:2");

        await expect(service.ingest("tenant-a", { sourceName: "bad.xlsx", format: "XLSX", contentBase64: Buffer.from("not-a-zip").toString("base64") }))
            .rejects.toThrow(/ingestion-(format-unsupported|excel-parse-error)/);

        expect(await service.listSources("tenant-a")).toHaveLength(0);
        persistence.close();
    });
});

describe("Phase 14-1.2 — ingestion runtime endpoints", () => {
    let server: Server;

    beforeEach(async () => {
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
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

    test("POST /api/ingest accepts CSV, STRUCTURED, TXT and XLSX for an authenticated owner", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const csv = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: CSV }),
        });
        expect(csv.status).toBe(201);
        const csvBody = await csv.json();
        expect(csvBody.status).toBe("READY");
        expect(csvBody.evidence.sourceType).toBe("CSV");
        expect(csvBody.source.persisted).toBe(true);

        const structured = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ sourceName: "ledger.json", format: "STRUCTURED", content: STRUCTURED }),
        });
        expect(structured.status).toBe(201);
        expect((await structured.json()).evidence.sourceType).toBe("STRUCTURED");

        const txt = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ sourceName: "ledger.txt", format: "TXT", content: TXT }),
        });
        expect(txt.status).toBe(201);

        const xlsxBytes = await createXlsxBytes();
        const xlsx = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ sourceName: "ledger.xlsx", format: "XLSX", contentBase64: xlsxBytes.toString("base64") }),
        });
        expect(xlsx.status).toBe(201);
        const xlsxBody = await xlsx.json();
        expect(xlsxBody.evidence.sourceType).toBe("XLSX");
        expect(xlsxBody.totals).toEqual({ debit: 1000, credit: 1000, balance: 0 });

        const list = await request(server, "/api/sources", { headers: { cookie } });
        expect(list.status).toBe(200);
        expect((await list.json()).sources).toHaveLength(4);

        const evidence = await request(server, `/api/sources/${xlsxBody.source.sha256}`, { headers: { cookie } });
        expect(evidence.status).toBe(200);
        expect((await evidence.json()).source.contentEncoding).toBe("base64");
    });

    test("POST /api/ingest rejects unsupported formats and malformed payloads", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const unsupported = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ sourceName: "ledger.pdf", format: "PDF", content: "x" }),
        });
        expect(unsupported.status).toBe(400);
        expect((await unsupported.json()).error).toBe("INGEST_FORMAT_UNSUPPORTED");

        const missingContent = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV" }),
        });
        expect(missingContent.status).toBe(400);
        expect((await missingContent.json()).error).toBe("CONTENT_REQUIRED");

        const malformed = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify({ sourceName: "bad.csv", format: "CSV", content: "date,account,debit,credit,currency\n2026-08-01,Cash,100,50,IRR" }),
        });
        expect(malformed.status).toBe(422);
        expect((await malformed.json()).error).toBe("ingestion-double-sided-row:2");
    });

    test("RBAC and tenant isolation: viewer denied ingest, other tenant cannot read evidence", async () => {
        const owner = await register("owner", "Acme");
        const ownerCookie = cookieFrom(owner);
        const viewer = await register("viewer", "Acme");
        const viewerCookie = cookieFrom(viewer);

        const viewerIngest = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json", cookie: viewerCookie },
            body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: CSV }),
        });
        expect(viewerIngest.status).toBe(403);

        const ownerIngest = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json", cookie: ownerCookie },
            body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: CSV }),
        });
        const ownerBody = await ownerIngest.json();
        expect(ownerIngest.status).toBe(201);

        const other = await register("other-owner", "Other");
        const otherCookie = cookieFrom(other);
        const otherRead = await request(server, `/api/sources/${ownerBody.source.sha256}`, { headers: { cookie: otherCookie } });
        expect(otherRead.status).toBe(404);
        expect((await otherRead.json()).error).toBe("SOURCE_NOT_FOUND");

        const unauthenticated = await request(server, "/api/ingest", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ sourceName: "ledger.csv", format: "CSV", content: CSV }),
        });
        expect(unauthenticated.status).toBe(401);
    });
});
