import { ReportExportService, REPORT_ARTIFACT_KEY_PREFIX } from "../Product/ReportExportService";
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import type { ReportSection } from "../Engines/ReportsEngine";

const SECTIONS: ReportSection[] = [
    { heading: "Overview", lines: ["Tenant: tenant-a", "Source: ledger.csv"] },
    { heading: "Financial statement", lines: ["Revenue: 1000", "Profit: 250"] },
];

const createService = () => {
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const service = new ReportExportService(persistence, undefined, () => 1_900_000_000_000);
    return { persistence, service };
};

describe("product.reports-export — composition boundary", () => {
    test("requires the tenant boundary", async () => {
        const { service } = createService();
        await expect(service.generate({ tenantId: "   ", title: "r", sections: SECTIONS, format: "TXT" }))
            .rejects.toThrow("report-export-tenant-required");
        await expect(service.read("  ", "report-deadbeef")).rejects.toThrow("report-export-tenant-required");
    });

    test("generates and persists a tenant-scoped artifact with provenance", async () => {
        const { service } = createService();
        const result = await service.generate({
            tenantId: "tenant-a",
            title: "Monthly Report",
            sections: SECTIONS,
            format: "CSV",
            sourceRef: "financial-ingestion:" + "a".repeat(64),
        });
        expect(result.status).toBe("READY");
        if (result.status !== "READY") return;
        const { artifact } = result;
        expect(artifact.artifactId).toMatch(/^report-[a-f0-9]{32}$/);
        expect(artifact.tenantId).toBe("tenant-a");
        expect(artifact.format).toBe("CSV");
        expect(artifact.contentType).toBe("text/csv; charset=utf-8");
        expect(artifact.byteLength).toBeGreaterThan(0);
        expect(artifact.sha256).toHaveLength(64);
        expect(artifact.generatedAt).toBe("2030-03-17T17:46:40.000Z");
        expect(artifact.provenance.verificationStatus).toBe("VERIFIED");
        expect(artifact.provenance.decisionRef).toBe(artifact.artifactId);
        expect(artifact.provenance.transformationRef).toBe("reports-engine:CSV");
        expect(artifact.provenance.sourceRef).toBe("financial-ingestion:" + "a".repeat(64));
        expect(result.downloadPath).toBe(`/api/report/artifacts/${artifact.artifactId}/download`);

        const download = await service.read("tenant-a", artifact.artifactId);
        expect(download).not.toBeNull();
        expect(download!.content.length).toBe(artifact.byteLength);
        expect(download!.metadata.sha256).toBe(artifact.sha256);
    });

    test("lists artifacts newest-first for the owning tenant only", async () => {
        const { service } = createService();
        await service.generate({ tenantId: "tenant-a", title: "First", sections: SECTIONS, format: "TXT", generatedAt: "2026-01-01T00:00:00.000Z" });
        await service.generate({ tenantId: "tenant-a", title: "Second", sections: SECTIONS, format: "JSON", generatedAt: "2026-01-02T00:00:00.000Z" });

        const listA = await service.list("tenant-a");
        expect(listA).toHaveLength(2);
        expect(listA[0].title).toBe("Second");
        expect(listA[1].title).toBe("First");
        expect(await service.list("tenant-b")).toEqual([]);
    });

    test("denies cross-tenant reads of a known artifact id", async () => {
        const { service } = createService();
        const created = await service.generate({ tenantId: "tenant-a", title: "Secret", sections: SECTIONS, format: "XLSX" });
        expect(created.status).toBe("READY");
        if (created.status !== "READY") return;
        expect(await service.read("tenant-b", created.artifact.artifactId)).toBeNull();
    });

    test("fails closed on invalid report content and malformed artifact ids", async () => {
        const { service } = createService();
        const blocked = await service.generate({ tenantId: "tenant-a", title: "Empty", sections: [], format: "TXT" });
        expect(blocked).toEqual({ status: "BLOCKED", reason: "REPORT_SECTIONS_REQUIRED" });
        expect(await service.read("tenant-a", "not-an-artifact-id")).toBeNull();
    });

    test("rejects a tampered stored artifact through the integrity check", async () => {
        const { persistence, service } = createService();
        const created = await service.generate({ tenantId: "tenant-a", title: "Integrity", sections: SECTIONS, format: "TXT" });
        expect(created.status).toBe("READY");
        if (created.status !== "READY") return;
        const { artifactId } = created.artifact;
        const record = await persistence.read({ tenantId: "tenant-a" }, `${REPORT_ARTIFACT_KEY_PREFIX}${artifactId}`);
        const stored = record!.value as Record<string, unknown>;
        await persistence.write({ tenantId: "tenant-a" }, `${REPORT_ARTIFACT_KEY_PREFIX}${artifactId}`, {
            ...stored,
            contentBase64: Buffer.from("tampered-bytes", "utf8").toString("base64"),
        });
        expect(await service.read("tenant-a", artifactId)).toBeNull();
    });
});
