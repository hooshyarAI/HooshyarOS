/**
 * product.reports-export — composition boundary over the canonical
 * `ReportsEngine`.
 *
 * `ReportsEngine` remains the single report capability owner and is the only
 * component that builds report content and serializes it into real file bytes
 * (TXT/CSV/JSON/XLSX). This service is deliberately NOT a second report engine:
 * it owns no report semantics. It only adds the product/transaction concerns
 * around the engine:
 *
 *   - tenant-scoped persistence of the generated artifact,
 *   - canonical provenance linking (ProvenanceTrace),
 *   - SHA-256 integrity verification on retrieval,
 *   - a tenant-isolated artifact index and opaque artifact identity.
 *
 * Access control (authentication/RBAC) is enforced at the runtime boundary; the
 * persistence scope plus the explicit tenant re-check here make cross-tenant
 * reads fail closed even if an artifact id is guessed.
 */
import { createHash, randomBytes } from "node:crypto";
import {
    ReportsEngine,
    SUPPORTED_REPORT_FORMATS,
    type ReportArtifact,
    type ReportDocument,
    type ReportFormat,
    type ReportSection,
} from "../Engines/ReportsEngine";
import { ProvenanceTrace, type ProvenanceLink } from "../Core/ProvenanceTrace";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";

export const REPORT_ARTIFACT_INDEX_KEY = "report-artifacts:index";
export const REPORT_ARTIFACT_KEY_PREFIX = "report-artifact:";
const MAX_REPORT_ARTIFACTS = 50;
const ARTIFACT_ID_PATTERN = /^report-[a-f0-9]{32}$/;

export interface ReportExportInput {
    readonly tenantId: string;
    readonly title: string;
    readonly sections: readonly ReportSection[];
    readonly format: ReportFormat;
    readonly generatedAt?: string;
    readonly metadata?: Readonly<Record<string, string>>;
    /** Canonical source reference (e.g. financial source sha256) for provenance. */
    readonly sourceRef?: string;
}

export interface ReportArtifactMetadata {
    readonly artifactId: string;
    readonly tenantId: string;
    readonly title: string;
    readonly format: ReportFormat;
    readonly contentType: string;
    readonly fileExtension: string;
    readonly fileName: string;
    readonly sha256: string;
    readonly byteLength: number;
    readonly generatedAt: string;
    readonly provenance: ProvenanceLink;
}

export interface StoredReportArtifact extends ReportArtifactMetadata {
    readonly contentBase64: string;
}

export interface ReportArtifactDownload {
    readonly metadata: ReportArtifactMetadata;
    readonly content: Buffer;
}

export type ReportExportResult =
    | { readonly status: "READY"; readonly artifact: ReportArtifactMetadata; readonly downloadPath: string }
    | { readonly status: "BLOCKED"; readonly reason: string };

const toMetadata = (stored: StoredReportArtifact): ReportArtifactMetadata => ({
    artifactId: stored.artifactId,
    tenantId: stored.tenantId,
    title: stored.title,
    format: stored.format,
    contentType: stored.contentType,
    fileExtension: stored.fileExtension,
    fileName: stored.fileName,
    sha256: stored.sha256,
    byteLength: stored.byteLength,
    generatedAt: stored.generatedAt,
    provenance: stored.provenance,
});

export class ReportExportService {
    readonly capabilityId = "product.reports-export" as const;
    readonly targetEngine = "Reports Engine" as const;

    constructor(
        private readonly persistence: SQLitePersistenceStore,
        private readonly reports: ReportsEngine = new ReportsEngine(),
        private readonly now: () => number = () => Date.now(),
    ) {}

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    static isSupportedFormat(format: string): format is ReportFormat {
        return SUPPORTED_REPORT_FORMATS.includes(format as ReportFormat);
    }

    async generate(input: ReportExportInput): Promise<ReportExportResult> {
        const tenantId = input?.tenantId?.trim() ?? "";
        if (!tenantId) throw new Error("report-export-tenant-required");

        const document: ReportDocument = {
            title: input.title,
            tenantId,
            generatedAt: input.generatedAt ?? new Date(this.now()).toISOString(),
            metadata: input.metadata,
            sections: input.sections,
        };

        const rendered = await this.reports.render(document, input.format);
        if (rendered.status !== "READY") return { status: "BLOCKED", reason: rendered.reason };

        const artifactId = `report-${randomBytes(16).toString("hex")}`;
        const provenance = ProvenanceTrace.createProvenanceLink({
            sourceRef: input.sourceRef?.trim() || `tenant:${tenantId}`,
            inputRef: ProvenanceTrace.hashInput(JSON.stringify({
                title: document.title,
                tenantId,
                generatedAt: document.generatedAt,
                sections: document.sections,
            })),
            transformationRef: `reports-engine:${input.format}`,
            reasoningRef: this.capabilityId,
            decisionRef: artifactId,
        });

        const metadata: ReportArtifactMetadata = {
            artifactId,
            tenantId,
            title: document.title,
            format: rendered.artifact.format,
            contentType: rendered.artifact.contentType,
            fileExtension: rendered.artifact.fileExtension,
            fileName: rendered.artifact.fileName,
            sha256: rendered.artifact.sha256,
            byteLength: rendered.artifact.byteLength,
            generatedAt: document.generatedAt,
            provenance,
        };

        const record: StoredReportArtifact = { ...metadata, contentBase64: rendered.artifact.bytes.toString("base64") };
        await this.persistence.write({ tenantId }, `${REPORT_ARTIFACT_KEY_PREFIX}${artifactId}`, record);
        await this.appendIndex(tenantId, metadata);

        return { status: "READY", artifact: metadata, downloadPath: `/api/report/artifacts/${artifactId}/download` };
    }

    async read(tenantId: string, artifactId: string): Promise<ReportArtifactDownload | null> {
        const scopeTenant = tenantId?.trim() ?? "";
        if (!scopeTenant) throw new Error("report-export-tenant-required");
        const id = artifactId?.trim() ?? "";
        if (!ARTIFACT_ID_PATTERN.test(id)) return null;

        const persisted = await this.persistence.read({ tenantId: scopeTenant }, `${REPORT_ARTIFACT_KEY_PREFIX}${id}`);
        const stored = persisted?.value as StoredReportArtifact | undefined;
        if (!stored || stored.tenantId !== scopeTenant || stored.artifactId !== id || typeof stored.contentBase64 !== "string") {
            return null;
        }

        const content = Buffer.from(stored.contentBase64, "base64");
        if (createHash("sha256").update(content).digest("hex") !== stored.sha256) return null;
        return { metadata: toMetadata(stored), content };
    }

    async list(tenantId: string): Promise<ReportArtifactMetadata[]> {
        const scopeTenant = tenantId?.trim() ?? "";
        if (!scopeTenant) throw new Error("report-export-tenant-required");
        const persisted = await this.persistence.read({ tenantId: scopeTenant }, REPORT_ARTIFACT_INDEX_KEY);
        const entries = persisted?.value;
        if (!Array.isArray(entries)) return [];
        return (entries as StoredReportArtifact[])
            .filter((entry) => entry && entry.tenantId === scopeTenant && typeof entry.artifactId === "string")
            .map((entry) => toMetadata(entry));
    }

    private async appendIndex(tenantId: string, metadata: ReportArtifactMetadata): Promise<void> {
        const existing = await this.list(tenantId);
        const next = [metadata, ...existing.filter((entry) => entry.artifactId !== metadata.artifactId)]
            .slice(0, MAX_REPORT_ARTIFACTS);
        await this.persistence.write({ tenantId }, REPORT_ARTIFACT_INDEX_KEY, next);
    }
}
