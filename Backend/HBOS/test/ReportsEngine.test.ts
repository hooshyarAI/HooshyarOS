import ExcelJS from "exceljs-hardened";
import { ReportsEngine, type ReportDocument } from "../Engines/ReportsEngine";

const DOCUMENT: ReportDocument = {
    title: "Monthly Financial Report",
    tenantId: "tenant-a",
    generatedAt: "2026-01-01T00:00:00.000Z",
    metadata: { Source: "ledger.csv" },
    sections: [
        { heading: "Overview", lines: ["Revenue: 1000", "Profit: 250"] },
        { heading: "Observations", lines: ["Observations: margin healthy"] },
    ],
};

describe("ReportsEngine", () => {
    it("exposes canonical identity and health", () => {
        const engine = new ReportsEngine();
        expect(engine.name).toBe("ReportsEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability().id).toBe("platform.reports");
    });

    it("builds a report from validated sections", () => {
        const result = new ReportsEngine().build("Monthly report", ["Revenue", "Profit"]);
        expect(result.status).toBe("READY");
        expect(result.sections).toEqual(["Revenue", "Profit"]);
    });

    it("advertises only the genuinely supported file formats", () => {
        expect(new ReportsEngine().supportedFormats()).toEqual(["TXT", "CSV", "JSON", "XLSX"]);
    });

    it("renders real TXT bytes with content type and integrity metadata", async () => {
        const result = await new ReportsEngine().render(DOCUMENT, "TXT");
        expect(result.status).toBe("READY");
        if (result.status !== "READY") return;
        const { artifact } = result;
        expect(artifact.contentType).toBe("text/plain; charset=utf-8");
        expect(artifact.fileExtension).toBe("txt");
        expect(artifact.fileName).toMatch(/^monthly-financial-report-[a-f0-9]{12}\.txt$/);
        expect(artifact.byteLength).toBe(artifact.bytes.length);
        expect(artifact.sha256).toHaveLength(64);
        const text = artifact.bytes.toString("utf8");
        expect(text).toContain("Monthly Financial Report");
        expect(text).toContain("Tenant: tenant-a");
        expect(text).toContain("Source: ledger.csv");
        expect(text).toContain("* Revenue: 1000");
    });

    it("renders structurally valid CSV", async () => {
        const result = await new ReportsEngine().render(DOCUMENT, "CSV");
        expect(result.status).toBe("READY");
        if (result.status !== "READY") return;
        expect(result.artifact.contentType).toBe("text/csv; charset=utf-8");
        const lines = result.artifact.bytes.toString("utf8").trim().split("\r\n");
        expect(lines[0]).toBe('"Section","Entry"');
        expect(lines).toContain('"Report","Tenant: tenant-a"');
        expect(lines).toContain('"Overview","Revenue: 1000"');
    });

    it("renders structurally valid JSON", async () => {
        const result = await new ReportsEngine().render(DOCUMENT, "JSON");
        expect(result.status).toBe("READY");
        if (result.status !== "READY") return;
        expect(result.artifact.contentType).toBe("application/json; charset=utf-8");
        const parsed = JSON.parse(result.artifact.bytes.toString("utf8"));
        expect(parsed.title).toBe("Monthly Financial Report");
        expect(parsed.tenantId).toBe("tenant-a");
        expect(parsed.sections).toHaveLength(2);
        expect(parsed.sections[0].lines).toContain("Revenue: 1000");
    });

    it("renders a real, re-readable XLSX workbook", async () => {
        const result = await new ReportsEngine().render(DOCUMENT, "XLSX");
        expect(result.status).toBe("READY");
        if (result.status !== "READY") return;
        const { artifact } = result;
        expect(artifact.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        expect(artifact.bytes[0]).toBe(0x50);
        expect(artifact.bytes[1]).toBe(0x4b);
        expect(artifact.byteLength).toBeGreaterThan(1000);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(artifact.bytes as unknown as ArrayBuffer);
        const sheet = workbook.getWorksheet("Report");
        expect(sheet).toBeDefined();
        const entries = (sheet!.getColumn(2).values as unknown as unknown[]).map((value) => String(value ?? ""));
        expect(entries).toContain("Revenue: 1000");
        expect(entries).toContain("Observations: margin healthy");
    });

    it("is deterministic for identical documents", async () => {
        const engine = new ReportsEngine();
        const first = await engine.render(DOCUMENT, "TXT");
        const second = await engine.render(DOCUMENT, "TXT");
        expect(first.status).toBe("READY");
        expect(second.status).toBe("READY");
        if (first.status !== "READY" || second.status !== "READY") return;
        expect(first.artifact.sha256).toBe(second.artifact.sha256);
    });

    it("fails closed on invalid documents and unsupported formats", async () => {
        const engine = new ReportsEngine();
        const noSections = await engine.render({ ...DOCUMENT, sections: [] }, "TXT");
        expect(noSections).toEqual({ status: "BLOCKED", reason: "REPORT_SECTIONS_REQUIRED" });

        const noTitle = await engine.render({ ...DOCUMENT, title: "  " }, "TXT");
        expect(noTitle.status).toBe("BLOCKED");

        const unsupported = await engine.render(DOCUMENT, "PDF" as never);
        expect(unsupported).toEqual({ status: "BLOCKED", reason: "REPORT_FORMAT_UNSUPPORTED" });
    });
});
