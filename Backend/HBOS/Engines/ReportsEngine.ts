import { createHash } from "node:crypto";
import ExcelJS from "exceljs-hardened";
import { Engine } from "../Core/Engine";

export interface ReportResult { title: string; sections: string[]; status: "READY" | "BLOCKED"; }

/**
 * Real, downloadable report formats. Only formats that can be rendered as
 * genuine structural bytes with the frozen dependency set are claimed; PDF and
 * DOCX are intentionally absent because the repository only owns readers for
 * those formats (pdf-parse / mammoth), not writers.
 */
export type ReportFormat = "TXT" | "CSV" | "JSON" | "XLSX";

export const SUPPORTED_REPORT_FORMATS: readonly ReportFormat[] = Object.freeze(["TXT", "CSV", "JSON", "XLSX"]);

export interface ReportSection {
    readonly heading: string;
    readonly lines: readonly string[];
}

export interface ReportDocument {
    readonly title: string;
    readonly tenantId: string;
    readonly generatedAt: string;
    readonly metadata?: Readonly<Record<string, string>>;
    readonly sections: readonly ReportSection[];
}

export interface ReportArtifact {
    readonly format: ReportFormat;
    readonly contentType: string;
    readonly fileExtension: string;
    readonly fileName: string;
    readonly bytes: Buffer;
    readonly sha256: string;
    readonly byteLength: number;
}

export type ReportRenderResult =
    | { readonly status: "READY"; readonly artifact: ReportArtifact }
    | { readonly status: "BLOCKED"; readonly reason: string };

const CONTENT_TYPES: Record<ReportFormat, string> = {
    TXT: "text/plain; charset=utf-8",
    CSV: "text/csv; charset=utf-8",
    JSON: "application/json; charset=utf-8",
    XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const FILE_EXTENSIONS: Record<ReportFormat, string> = {
    TXT: "txt",
    CSV: "csv",
    JSON: "json",
    XLSX: "xlsx",
};

const slugify = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "report";

export class ReportsEngine implements Engine {
    name = "ReportsEngine";
    initialize(): void {}
    health(): boolean { return true; }
    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return { id: "platform.reports", capability: "implement Reports capability", targetEngine: "Reports Engine" };
    }
    build(title: string, sections: string[]): ReportResult {
        if (!title.trim() || !Array.isArray(sections) || sections.some(section => !section.trim())) {
            return { title, sections: [], status: "BLOCKED" };
        }
        return { title, sections, status: "READY" };
    }

    supportedFormats(): ReportFormat[] {
        return [...SUPPORTED_REPORT_FORMATS];
    }

    /**
     * Render a validated report document into real file bytes.
     *
     * Deterministic and tenant-agnostic: this engine owns report construction and
     * serialization only. Persistence, provenance and access control are the
     * runtime/product composition boundary's responsibility.
     */
    async render(document: ReportDocument, format: ReportFormat): Promise<ReportRenderResult> {
        const reason = this.validate(document, format);
        if (reason) return { status: "BLOCKED", reason };

        const bytes = format === "XLSX"
            ? await this.renderXlsx(document)
            : Buffer.from(
                format === "TXT" ? this.renderText(document)
                    : format === "CSV" ? this.renderCsv(document)
                        : this.renderJson(document),
                "utf8"
            );

        const sha256 = createHash("sha256").update(bytes).digest("hex");
        return {
            status: "READY",
            artifact: {
                format,
                contentType: CONTENT_TYPES[format],
                fileExtension: FILE_EXTENSIONS[format],
                fileName: `${slugify(document.title)}-${sha256.slice(0, 12)}.${FILE_EXTENSIONS[format]}`,
                bytes,
                sha256,
                byteLength: bytes.length,
            },
        };
    }

    private validate(document: ReportDocument, format: ReportFormat): string | null {
        if (!SUPPORTED_REPORT_FORMATS.includes(format)) return "REPORT_FORMAT_UNSUPPORTED";
        if (!document || typeof document !== "object") return "REPORT_DOCUMENT_REQUIRED";
        if (!String(document.title ?? "").trim()) return "REPORT_TITLE_REQUIRED";
        if (!String(document.tenantId ?? "").trim()) return "REPORT_TENANT_REQUIRED";
        if (!Array.isArray(document.sections) || document.sections.length === 0) return "REPORT_SECTIONS_REQUIRED";
        for (const section of document.sections) {
            if (!section || !String(section.heading ?? "").trim()) return "REPORT_SECTION_HEADING_REQUIRED";
            if (!Array.isArray(section.lines) || !section.lines.some((line) => String(line ?? "").trim())) {
                return "REPORT_SECTION_CONTENT_REQUIRED";
            }
        }
        return null;
    }

    private header(document: ReportDocument): string[] {
        const lines = [document.title, `Tenant: ${document.tenantId}`, `Generated: ${document.generatedAt}`];
        for (const [key, value] of Object.entries(document.metadata ?? {})) lines.push(`${key}: ${value}`);
        return lines;
    }

    private renderText(document: ReportDocument): string {
        const lines: string[] = this.header(document);
        lines.push("");
        for (const section of document.sections) {
            lines.push(section.heading.toUpperCase());
            lines.push("-".repeat(section.heading.length));
            for (const line of section.lines) lines.push(`* ${line}`);
            lines.push("");
        }
        return `${lines.join("\r\n")}\r\n`;
    }

    private renderCsv(document: ReportDocument): string {
        const escape = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
        const rows: string[] = [`${escape("Section")},${escape("Entry")}`];
        for (const line of this.header(document)) rows.push(`${escape("Report")},${escape(line)}`);
        for (const section of document.sections) {
            for (const line of section.lines) rows.push(`${escape(section.heading)},${escape(line)}`);
        }
        return `${rows.join("\r\n")}\r\n`;
    }

    private renderJson(document: ReportDocument): string {
        return JSON.stringify(
            {
                title: document.title,
                tenantId: document.tenantId,
                generatedAt: document.generatedAt,
                metadata: document.metadata ?? {},
                sections: document.sections,
            },
            null,
            2
        );
    }

    private async renderXlsx(document: ReportDocument): Promise<Buffer> {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "HooshyarOS ReportsEngine";
        workbook.created = new Date(document.generatedAt);
        const sheet = workbook.addWorksheet("Report");
        sheet.columns = [
            { header: "Section", key: "section", width: 28 },
            { header: "Entry", key: "entry", width: 90 },
        ];
        for (const line of this.header(document)) sheet.addRow({ section: "Report", entry: line });
        for (const section of document.sections) {
            sheet.addRow({ section: "", entry: "" });
            for (const line of section.lines) sheet.addRow({ section: section.heading, entry: line });
        }
        const buffer = await workbook.xlsx.writeBuffer();
        return Buffer.from(buffer as ArrayBuffer);
    }
}
