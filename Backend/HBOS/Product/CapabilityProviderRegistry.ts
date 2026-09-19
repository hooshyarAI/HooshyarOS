/**
 * HooshyarOS — Capability Provider Leverage (canonical supporting service).
 *
 * Canonical owner of the "standard -> existing tool -> internal capability ->
 * adapter/provider -> native" reuse policy for external capabilities.
 *
 * This module is NOT a new Engine and it does not duplicate an existing owner:
 *   - `ConnectorRegistry` owns tenant connector lifecycle
 *     (registered -> tested -> enabled -> disabled -> retired);
 *   - `ExternalProductionDependencyAudit` owns external production resource
 *     readiness (payment provider / production cloud);
 *   - the Engine `DependencyManager` owns engine relationships and startup order.
 * This service owns dependency admission and provider selection for external
 * capabilities.
 *
 * Governing law: `Docs/HOOSHYAROS_CAPABILITY_PROVIDER_LEVERAGE_LAW.md`.
 *
 * HooshyarOS keeps canonical ownership of domain/data models, tenant
 * boundaries, identity, security policy, provenance, audit/governance,
 * validation, business rules and intelligence. A provider is only ever a
 * capability behind the `replaceableVia` adapter boundary.
 */

export type CapabilityCategory =
  | "document.pdf.text"
  | "document.pdf.ocr"
  | "document.pdf.rasterize"
  | "document.docx.text"
  | "document.html.text"
  | "document.xml.text"
  | "document.rtf.text"
  | "document.odt.text"
  | "document.xls.parse"
  | "document.yaml.parse"
  | "document.ebook.epub"
  | "document.broad.parse"
  | "presentation.pptx.text"
  | "mail.eml.parse"
  | "mail.msg.parse"
  | "database.dbf.parse"
  | "image.tiff.decode"
  | "spreadsheet.xlsx.parse"
  | "text.tsv.parse"
  | "persistence.sqlite"
  | "encoding.hash.sha256"
  | "encoding.text.decode"
  | "data.rest.graphql"
  | "data.database.access"
  | "data.sftp"
  | "identity.federated-auth"
  | "enterprise.erp.accounting";

/**
 * Canonical evaluation order. A capability must be filled by the earliest tier
 * that can satisfy it; a later tier is only admissible when the earlier tiers
 * are demonstrated to be unavailable/unsuitable.
 */
export type ReuseTier =
  | "INDUSTRY_STANDARD"
  | "MATURE_LIBRARY"
  | "INTERNAL_CAPABILITY"
  | "ADAPTER_PROVIDER"
  | "NATIVE_IMPLEMENTATION";

export const REUSE_EVALUATION_ORDER: ReadonlyArray<ReuseTier> = [
  "INDUSTRY_STANDARD",
  "MATURE_LIBRARY",
  "INTERNAL_CAPABILITY",
  "ADAPTER_PROVIDER",
  "NATIVE_IMPLEMENTATION",
];

export type AdmissionStatus = "APPROVED" | "REJECTED" | "DEFERRED" | "CANDIDATE";

export type IntegrationState = "INTEGRATED" | "NOT_INTEGRATED";

export interface MaintenanceEvidence {
  /** Authoritative source inspected (in-repo path or upstream URL). */
  readonly source: string;
  /** ISO-8601 date the source was inspected. */
  readonly asOf: string;
  /** What the source does and does not establish. */
  readonly note: string;
}

/**
 * A single governed inventory entry. Fields whose names are qualified as
 * "engineering judgment" are decisions, not fetched facts; facts carry an
 * evidence pointer.
 */
export interface CapabilityProviderCandidate {
  readonly capabilityId: string;
  readonly capability: CapabilityCategory;
  readonly provider: string;
  readonly purpose: string;
  readonly reuseTier: ReuseTier;
  readonly status: AdmissionStatus;
  readonly integration: IntegrationState;

  /** package.json dependency key. Required for an INTEGRATED MATURE_LIBRARY. */
  readonly declaredDependency?: string;

  readonly license?: string;
  readonly licenseEvidence?: string;
  readonly commercialUseCompatible?: boolean;
  readonly selfHostedOffline?: boolean;
  readonly maintenance?: MaintenanceEvidence;
  readonly securityConsiderations?: string;

  /** The HooshyarOS boundary that keeps the provider replaceable. */
  readonly replaceableVia?: string;

  readonly provenanceResponsibility?: string;
  readonly testingResponsibility?: string;
  readonly upgradeResponsibility?: string;
  readonly deprecationHandling?: string;

  /** Required for NATIVE_IMPLEMENTATION: why earlier reuse tiers were unusable. */
  readonly nativeFallbackCriteria?: string;

  /** Conditions that must be satisfied before a non-approved entry can advance. */
  readonly unmetConditions?: ReadonlyArray<string>;

  readonly reason: string;
  readonly decidedBy: string;
  readonly decidedAt: string;
}

export interface AdmissionAssessment {
  readonly capabilityId: string;
  readonly admitted: boolean;
  readonly reasons: ReadonlyArray<string>;
  readonly requiredActions: ReadonlyArray<string>;
}

export interface DependencySnapshotEntry {
  readonly version: string;
  readonly license?: string;
}

export type DependencySnapshot = ReadonlyMap<string, DependencySnapshotEntry>;

export interface DependencyAuditViolation {
  readonly capabilityId: string;
  readonly dependency: string;
  readonly kind: "missing-declared-dependency" | "license-mismatch";
  readonly detail: string;
}

export interface DependencyAuditResult {
  readonly ok: boolean;
  readonly checked: number;
  readonly violations: ReadonlyArray<DependencyAuditViolation>;
}

export const CAPABILITY_PROVIDER_ERROR_CODES = {
  CAPABILITY_REQUIRED: "capability-provider-capability-required",
  PROVIDER_REQUIRED: "capability-provider-provider-required",
  PURPOSE_REQUIRED: "capability-provider-purpose-required",
  BOUNDARY_REQUIRED: "capability-provider-boundary-required",
  REASON_REQUIRED: "capability-provider-reason-required",
  DECISION_REQUIRED: "capability-provider-decision-required",
  ALREADY_REGISTERED: "capability-provider-already-registered",
  UNKNOWN: "capability-provider-unknown",
  NOT_ADMITTED: "capability-provider-not-admitted",
} as const;

export function reuseTierRank(tier: ReuseTier): number {
  const index = REUSE_EVALUATION_ORDER.indexOf(tier);
  return index === -1 ? REUSE_EVALUATION_ORDER.length : index;
}

/**
 * Fail-closed dependency-admission evaluation.
 *
 * A candidate is admitted only when it is APPROVED and every mandatory
 * admission fact/boundary is present. Non-approved candidates are never
 * admitted. Nothing is inferred: a missing field is a rejection reason, not a
 * default.
 */
export function assessProvider(candidate: CapabilityProviderCandidate): AdmissionAssessment {
  const reasons: string[] = [];
  const requiredActions: string[] = [];

  if (candidate.status !== "APPROVED") {
    reasons.push(`status-not-approved:${candidate.status}`);
    for (const condition of candidate.unmetConditions ?? []) {
      requiredActions.push(condition);
    }
    return { capabilityId: candidate.capabilityId, admitted: false, reasons, requiredActions };
  }

  const isExternal = candidate.reuseTier === "MATURE_LIBRARY" || candidate.reuseTier === "ADAPTER_PROVIDER";
  if (isExternal) {
    if (!candidate.license?.trim()) {
      reasons.push("license-missing");
      requiredActions.push("Record the provider license from an authoritative source");
    }
    if (!candidate.licenseEvidence?.trim()) {
      reasons.push("license-evidence-missing");
      requiredActions.push("Record the exact source used to verify the license");
    }
    if (candidate.commercialUseCompatible !== true) {
      reasons.push("commercial-use-not-confirmed");
      requiredActions.push("Confirm commercial-use compatibility before admission");
    }
    if (typeof candidate.selfHostedOffline !== "boolean") {
      reasons.push("self-hosting-status-undeclared");
      requiredActions.push("Declare whether the provider can run self-hosted/offline");
    }
    if (!candidate.maintenance) {
      reasons.push("maintenance-evidence-missing");
      requiredActions.push("Record maintenance/maturity evidence and its as-of date");
    }
  }

  const obligations: ReadonlyArray<readonly [keyof CapabilityProviderCandidate, string]> = [
    ["securityConsiderations", "security-considerations"],
    ["replaceableVia", "replaceability-boundary"],
    ["provenanceResponsibility", "provenance-responsibility"],
    ["testingResponsibility", "testing-responsibility"],
    ["upgradeResponsibility", "upgrade-responsibility"],
    ["deprecationHandling", "deprecation-handling"],
  ];
  for (const [field, label] of obligations) {
    const value = candidate[field];
    if (typeof value !== "string" || !value.trim()) {
      reasons.push(`${label}-missing`);
      requiredActions.push(`Record the ${label.replace(/-/g, " ")}`);
    }
  }

  if (candidate.reuseTier === "NATIVE_IMPLEMENTATION" && !candidate.nativeFallbackCriteria?.trim()) {
    reasons.push("native-fallback-criteria-missing");
    requiredActions.push("Document why no earlier reuse tier could satisfy the capability");
  }

  if (
    candidate.reuseTier === "MATURE_LIBRARY" &&
    candidate.integration === "INTEGRATED" &&
    !candidate.declaredDependency?.trim()
  ) {
    reasons.push("declared-dependency-missing");
    requiredActions.push("Name the declared package.json dependency for an integrated library");
  }

  return { capabilityId: candidate.capabilityId, admitted: reasons.length === 0, reasons, requiredActions };
}

export class CapabilityProviderRegistry {
  private readonly byId: Map<string, CapabilityProviderCandidate>;

  constructor(inventory: ReadonlyArray<CapabilityProviderCandidate> = HOOSHYAROS_CAPABILITY_PROVIDER_INVENTORY) {
    this.byId = new Map();
    for (const candidate of inventory) {
      this.register(candidate);
    }
  }

  register(candidate: CapabilityProviderCandidate): void {
    if (!candidate.capabilityId?.trim()) throw new Error(CAPABILITY_PROVIDER_ERROR_CODES.CAPABILITY_REQUIRED);
    if (!candidate.provider?.trim()) throw new Error(CAPABILITY_PROVIDER_ERROR_CODES.PROVIDER_REQUIRED);
    if (!candidate.purpose?.trim()) throw new Error(CAPABILITY_PROVIDER_ERROR_CODES.PURPOSE_REQUIRED);
    if (!candidate.replaceableVia?.trim()) throw new Error(CAPABILITY_PROVIDER_ERROR_CODES.BOUNDARY_REQUIRED);
    if (!candidate.reason?.trim()) throw new Error(CAPABILITY_PROVIDER_ERROR_CODES.REASON_REQUIRED);
    if (!candidate.decidedBy?.trim() || !candidate.decidedAt?.trim()) {
      throw new Error(CAPABILITY_PROVIDER_ERROR_CODES.DECISION_REQUIRED);
    }
    if (this.byId.has(candidate.capabilityId)) {
      throw new Error(`${CAPABILITY_PROVIDER_ERROR_CODES.ALREADY_REGISTERED}:${candidate.capabilityId}`);
    }
    this.byId.set(candidate.capabilityId, candidate);
  }

  getById(capabilityId: string): CapabilityProviderCandidate {
    const candidate = this.byId.get(capabilityId);
    if (!candidate) throw new Error(`${CAPABILITY_PROVIDER_ERROR_CODES.UNKNOWN}:${capabilityId}`);
    return candidate;
  }

  list(): ReadonlyArray<CapabilityProviderCandidate> {
    return [...this.byId.values()];
  }

  listByCapability(category: CapabilityCategory): ReadonlyArray<CapabilityProviderCandidate> {
    return this.list().filter((candidate) => candidate.capability === category);
  }

  assess(capabilityId: string): AdmissionAssessment {
    return assessProvider(this.getById(capabilityId));
  }

  /**
   * Select the preferred admitted, integrated provider for a capability using
   * the canonical evaluation order. Fails closed when none is admissible.
   */
  selectProvider(category: CapabilityCategory): CapabilityProviderCandidate {
    const eligible = this.listByCapability(category).filter(
      (candidate) => candidate.integration === "INTEGRATED" && assessProvider(candidate).admitted,
    );
    if (eligible.length === 0) {
      throw new Error(`${CAPABILITY_PROVIDER_ERROR_CODES.NOT_ADMITTED}:${category}`);
    }
    eligible.sort(
      (a, b) => reuseTierRank(a.reuseTier) - reuseTierRank(b.reuseTier) ||
        a.capabilityId.localeCompare(b.capabilityId),
    );
    return eligible[0];
  }

  /**
   * Truthfulness audit: every integrated third-party library recorded in the
   * inventory must exist in the real declared dependency snapshot, and any
   * recorded license must match the installed license.
   */
  auditDeclaredDependencies(snapshot: DependencySnapshot): DependencyAuditResult {
    const violations: DependencyAuditViolation[] = [];
    let checked = 0;

    for (const candidate of this.list()) {
      if (candidate.integration !== "INTEGRATED" || candidate.reuseTier !== "MATURE_LIBRARY") continue;
      const dependency = candidate.declaredDependency?.trim();
      if (!dependency) {
        violations.push({
          capabilityId: candidate.capabilityId,
          dependency: "<missing>",
          kind: "missing-declared-dependency",
          detail: "Integrated library has no declaredDependency.",
        });
        continue;
      }
      checked += 1;
      const entry = snapshot.get(dependency);
      if (!entry) {
        violations.push({
          capabilityId: candidate.capabilityId,
          dependency,
          kind: "missing-declared-dependency",
          detail: "Declared dependency is not present in the real dependency snapshot.",
        });
        continue;
      }
      if (candidate.license && entry.license && candidate.license !== entry.license) {
        violations.push({
          capabilityId: candidate.capabilityId,
          dependency,
          kind: "license-mismatch",
          detail: `Inventory license "${candidate.license}" != installed license "${entry.license}".`,
        });
      }
    }

    return { ok: violations.length === 0, checked, violations };
  }
}

/**
 * Governed inventory snapshot. The machine-readable inventory is canonical; the
 * governing law document defines the policy. Facts marked with a source were
 * verified in-repo on the recorded date; maintenance activity statements are
 * engineering judgment unless a source is named.
 */
export const HOOSHYAROS_CAPABILITY_PROVIDER_INVENTORY: ReadonlyArray<CapabilityProviderCandidate> = [
  {
    capabilityId: "pdf-text-native",
    capability: "document.pdf.text",
    provider: "pdf-parse",
    purpose: "Extract deterministic text + metadata from text-native PDFs for canonical financial ingestion.",
    reuseTier: "MATURE_LIBRARY",
    status: "APPROVED",
    integration: "INTEGRATED",
    declaredDependency: "pdf-parse",
    license: "Apache-2.0",
    licenseEvidence: "package.json#dependencies + node_modules/pdf-parse/package.json#license (verified 2026-09-19)",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    maintenance: {
      source: "package.json#dependencies + node_modules/pdf-parse/package.json (installed 2.4.5)",
      asOf: "2026-09-19",
      note: "Presence, pinned version and license were verified in-repo. Upstream release cadence was not fetched at decision time and is engineering judgment, not a recorded fact.",
    },
    securityConsiderations: "Parses untrusted bytes in-process with no network access; the canonical owner enforces %PDF magic, empty/corrupt/password classification and a scanned-page threshold before any model is persisted.",
    replaceableVia: "Product/PdfAcquisition.ts (single acquirePdf boundary; extracted text is normalized through the canonical ledger pipeline)",
    provenanceResponsibility: "HooshyarOS owns provenance: financial-ingestion:<sha256> uses the ORIGINAL PDF-byte SHA-256, never the extracted text.",
    testingResponsibility: "HooshyarOS owns focused tests (PdfAcquisition, PdfIngestionRuntime) and the PDF ingestion acceptance script.",
    upgradeResponsibility: "HooshyarOS pins the version in package.json and re-runs the focused PDF/runtime tests and acceptance script on upgrade.",
    deprecationHandling: "Re-verify the %PDF extraction contract; replace behind acquirePdf with another admitted provider or a bounded native extractor.",
    reason: "Text-native PDF ingestion is the reference implementation of the leverage strategy: a standard library provides extraction while HooshyarOS keeps the canonical model.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "spreadsheet-xlsx-exceljs-hardened",
    capability: "spreadsheet.xlsx.parse",
    provider: "exceljs-hardened",
    purpose: "Read cell values from untrusted XLSX workbooks with decompression-bomb limits and no formula evaluation.",
    reuseTier: "MATURE_LIBRARY",
    status: "APPROVED",
    integration: "INTEGRATED",
    declaredDependency: "exceljs-hardened",
    license: "MIT",
    licenseEvidence: "package.json#dependencies + node_modules/exceljs-hardened/package.json#license (verified 2026-09-19)",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    maintenance: {
      source: "package.json#dependencies + node_modules/exceljs-hardened/package.json (installed 5.0.0)",
      asOf: "2026-09-19",
      note: "Presence, pinned version and license verified in-repo. The hardened fork is deliberately pinned to preserve the CVE/zip-bomb protections.",
    },
    securityConsiderations: "Hardened fork provides zip-entry and total-uncompressed limits (CWE-409 defense); formulas are never evaluated, only cached values are read.",
    replaceableVia: "Product/FinancialDataIngestionAdapter.parseXlsx (single canonical XLSX route)",
    provenanceResponsibility: "HooshyarOS owns raw-source SHA-256 and the canonical financial model; the library only yields cell values.",
    testingResponsibility: "HooshyarOS owns the adapter XLSX tests and resource-policy tests.",
    upgradeResponsibility: "Upgrades must preserve the hardened security options and re-run the XLSX focused tests.",
    deprecationHandling: "Replace behind the canonical XLSX route with another admitted workbook reader; never weaken the zip-bomb limits.",
    reason: "A mature workbook library already provides hardened XLSX reading; rebuilding a spreadsheet parser natively would add risk without capability.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "persistence-sqlite-better-sqlite3",
    capability: "persistence.sqlite",
    provider: "better-sqlite3",
    purpose: "Local transactional persistence for tenant-scoped canonical records and raw-source evidence.",
    reuseTier: "MATURE_LIBRARY",
    status: "APPROVED",
    integration: "INTEGRATED",
    declaredDependency: "better-sqlite3",
    license: "MIT",
    licenseEvidence: "package.json#dependencies + node_modules/better-sqlite3/package.json#license (verified 2026-09-19)",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    maintenance: {
      source: "package.json#dependencies + node_modules/better-sqlite3/package.json (installed 13.0.3)",
      asOf: "2026-09-19",
      note: "Presence, pinned version and license verified in-repo. Upstream release cadence is engineering judgment, not a recorded fact.",
    },
    securityConsiderations: "SQLite standard file format; tenant scoping is enforced by HooshyarOS at the repository/persistence boundary, never delegated to the driver.",
    replaceableVia: "Persistence/SQLiteAdapter.ts + Product/SQLitePersistenceStore.ts",
    provenanceResponsibility: "HooshyarOS owns tenant boundaries and record identity; the driver only stores bytes.",
    testingResponsibility: "HooshyarOS owns persistence, isolation and idempotency tests.",
    upgradeResponsibility: "Upgrades re-run persistence, tenant-isolation and ingestion regression tests.",
    deprecationHandling: "The storage engine is behind the persistence boundary; a replacement must preserve tenant scoping and the stored record contract.",
    reason: "A mature embedded database is the standard solution; HooshyarOS keeps ownership of tenant boundaries and the canonical data model.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "encoding-sha256-node-crypto",
    capability: "encoding.hash.sha256",
    provider: "Node.js crypto (SHA-256)",
    purpose: "Content identity for raw sources, evidence and provenance chains.",
    reuseTier: "INDUSTRY_STANDARD",
    status: "APPROVED",
    integration: "INTEGRATED",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    securityConsiderations: "Uses the platform-standard SHA-256 implementation; HooshyarOS owns what is hashed and the provenance contract.",
    replaceableVia: "Product/FinancialDataIngestionAdapter.computeSourceSha256 (single hashing primitive)",
    provenanceResponsibility: "HooshyarOS owns the hash-to-evidence contract; the runtime only performs the digest.",
    testingResponsibility: "HooshyarOS owns provenance and raw-source tests.",
    upgradeResponsibility: "Node runtime upgrades re-run provenance tests; the digest algorithm is not changed without a governed decision.",
    deprecationHandling: "SHA-256 is an industry standard; a future transition would be an explicit, versioned provenance decision.",
    reason: "SHA-256 is an industry standard and a platform built-in, so no third-party hashing library should be introduced.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "encoding-text-node-whatwg",
    capability: "encoding.text.decode",
    provider: "Node.js Buffer + WHATWG TextDecoder",
    purpose: "Decode tenant text files (UTF-8 / UTF-8 BOM / UTF-16 LE / UTF-16 BE) into canonical text.",
    reuseTier: "INDUSTRY_STANDARD",
    status: "APPROVED",
    integration: "INTEGRATED",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    securityConsiderations: "Deterministic in-process decoding of bounded bytes; no network access and no code execution.",
    replaceableVia: "Product/TextFileDecoder.ts (single decoding boundary)",
    provenanceResponsibility: "HooshyarOS owns decoded-text provenance and the raw-byte SHA-256.",
    testingResponsibility: "HooshyarOS owns the text-decoder and TXT ingestion tests.",
    upgradeResponsibility: "Runtime upgrades re-run the text-decoder and TXT ingestion tests.",
    deprecationHandling: "WHATWG encoding is an industry standard; any change is a governed decoding decision.",
    reason: "Character decoding is standardized; the platform TextDecoder already provides it, so a native decoder must not be built.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "pdf-ocr-tesseract",
    capability: "document.pdf.ocr",
    provider: "tesseract.js",
    purpose: "OCR scanned/image-only PDF pages into text so they can enter the canonical ingestion pipeline.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "WASM/native OCR engine operating on untrusted images; requires size bounding, offline language-data provisioning and no uncontrolled network fetch to preserve data sovereignty.",
    replaceableVia: "Product/OcrAdapter.ts + Product/ScannedPdfRouter.ts (replaceable OCR-adapter contract)",
    provenanceResponsibility: "HooshyarOS would own OCR provenance (original-byte SHA-256 plus engine identity/confidence via Product/OcrProvenance.ts).",
    testingResponsibility: "HooshyarOS would own focused OCR tests and a bounded acceptance path; no PASS may be written without a real engine.",
    upgradeResponsibility: "Any admitted engine version would be pinned and re-verified against focused OCR tests.",
    deprecationHandling: "The capability is behind the OcrAdapter contract, so a provider can be replaced without touching canonical ingestion.",
    unmetConditions: [
      "Verify the current license from an authoritative source and record license evidence.",
      "Verify maintenance/maturity from an authoritative source and record it with an as-of date.",
      "Confirm offline/self-hosted and data-sovereignty behaviour (for example vendored language data instead of runtime download).",
      "Install and bound the engine in this repository without a runtime network fetch.",
      "Prove a commercial-use-compatible, size-bounded path with focused OCR tests before routing scanned PDFs.",
    ],
    reason: "OCR is the honest remaining PDF limitation. The rasterization half (pdf-parse screenshots) is now an admitted integrated provider, and the governed routing path (Product/ScannedPdfRouter.ts + FinancialDataIngestionAdapter.ingestScannedPdfBytes) exists, but no OCR ENGINE provider is admitted yet; installing one without satisfying admission criteria would violate the leverage law.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "pdf-rasterize-pdfparse",
    capability: "document.pdf.rasterize",
    provider: "pdf-parse (pdfjs-dist + @napi-rs/canvas)",
    purpose: "Render individual PDF pages to PNG bytes so scanned/image-only pages can be handed to the replaceable OCR adapter without any OCR engine owning PDF parsing.",
    reuseTier: "MATURE_LIBRARY",
    status: "APPROVED",
    integration: "INTEGRATED",
    declaredDependency: "pdf-parse",
    license: "Apache-2.0",
    licenseEvidence: "package.json#dependencies + node_modules/pdf-parse/package.json#license (verified 2026-09-19)",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    maintenance: {
      source: "package.json#dependencies + node_modules/pdf-parse/package.json (installed 2.4.5, render stack pdfjs-dist 5.4.296 + @napi-rs/canvas 0.1.80)",
      asOf: "2026-09-19",
      note: "Presence, pinned version and license verified in-repo; the rasterizer is reached through the already-admitted pdf-parse dependency, so no new third-party dependency is introduced.",
    },
    securityConsiderations: "Renders untrusted PDFs in-process with no network access; page count and per-page byte size are bounded, parsing errors fail closed, and the single worker-backed parser instance is accessed sequentially.",
    replaceableVia: "Product/PdfPageRasterizer.ts (single rasterizePage/rasterizeAll boundary; the OCR route consumes only that interface)",
    provenanceResponsibility: "HooshyarOS owns provenance: OCR output stays anchored to the ORIGINAL PDF-byte SHA-256, never to a rendered image.",
    testingResponsibility: "HooshyarOS owns the focused rasterizer tests with an injected parser factory and the governed scanned-PDF routing tests.",
    upgradeResponsibility: "HooshyarOS pins pdf-parse in package.json and re-runs the PDF, rasterizer and OCR-routing tests on upgrade.",
    deprecationHandling: "Replace behind PdfPageRasterizer with another admitted renderer; the OCR adapter and canonical ingestion are unaffected.",
    reason: "Page rasterization is a prerequisite for scanned-PDF OCR. It is provided by the already-admitted pdf-parse dependency and exposed behind a replaceable boundary instead of building a native renderer.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "document-docx-mammoth",
    capability: "document.docx.text",
    provider: "mammoth",
    purpose: "Extract plain text and document tables from DOCX documents for canonical ingestion.",
    reuseTier: "MATURE_LIBRARY",
    status: "APPROVED",
    integration: "INTEGRATED",
    declaredDependency: "mammoth",
    license: "BSD-2-Clause",
    licenseEvidence: "package.json#dependencies + node_modules/mammoth/package.json#license (verified 2026-09-19)",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    maintenance: {
      source: "package.json#dependencies + node_modules/mammoth/package.json (installed 1.12.2)",
      asOf: "2026-09-19",
      note: "Presence, pinned version and license verified in-repo. Upstream release cadence is engineering judgment, not a recorded fact.",
    },
    securityConsiderations: "Parses untrusted ZIP-based DOCX in-process with no network access; legacy binary DOC is rejected explicitly, extracted text/tables are mapped through the canonical ledger pipeline, and no macro or embedded code is ever executed.",
    replaceableVia: "Product/DocxAcquisition.ts (single acquireDocx boundary; canonical routing in FinancialDataIngestionAdapter.ingestDocxBytes)",
    provenanceResponsibility: "HooshyarOS owns provenance: the canonical model's SHA-256 is the ORIGINAL DOCX-byte hash, never the extracted text.",
    testingResponsibility: "HooshyarOS owns the DOCX acquisition and canonical-routing focused tests.",
    upgradeResponsibility: "HooshyarOS pins mammoth in package.json and re-runs the DOCX acquisition and ingestion tests on upgrade.",
    deprecationHandling: "Replace behind the DOCX acquisition boundary; canonical models, validation and provenance are unaffected.",
    reason: "The declared dependency was already present; the canonical owner now routes DOCX end-to-end with focused tests, so the previously deferred condition is satisfied.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "document-html-internal",
    capability: "document.html.text",
    provider: "HooshyarOS MarkupTextExtraction (Node built-ins only)",
    purpose: "Extract table structure or bounded visible text from untrusted HTML for canonical ingestion.",
    reuseTier: "INTERNAL_CAPABILITY",
    status: "APPROVED",
    integration: "INTEGRATED",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    securityConsiderations: "Discards <script>/<style>, never executes active content, performs no network resolution, bounds payload size, and maps only tables that match the canonical ledger schema.",
    replaceableVia: "Product/MarkupTextExtraction.ts (single htmlToText/extractMarkupTables boundary)",
    provenanceResponsibility: "HooshyarOS owns the source SHA-256 and canonical model; extraction never invents missing cells.",
    testingResponsibility: "HooshyarOS owns the focused HTML extraction and canonical-routing tests.",
    upgradeResponsibility: "Extend the internal extractor directly; no third-party dependency is involved.",
    deprecationHandling: "The extractor is an internal capability and can be replaced without changing the canonical adapter.",
    reason: "HTML extraction is achievable with bounded Node built-ins; no third-party dependency is justified for this capability.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "document-xml-internal",
    capability: "document.xml.text",
    provider: "HooshyarOS MarkupTextExtraction (Node built-ins only)",
    purpose: "Safely extract text or a repeating <transaction> element contract from untrusted XML for canonical ingestion.",
    reuseTier: "INTERNAL_CAPABILITY",
    status: "APPROVED",
    integration: "INTEGRATED",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    securityConsiderations: "Rejects <!DOCTYPE>/<!ENTITY> before processing (XXE / entity-expansion defense), performs no external entity resolution, and bounds payload size.",
    replaceableVia: "Product/MarkupTextExtraction.ts (single xmlToText/extractRepeatingXmlElements boundary)",
    provenanceResponsibility: "HooshyarOS owns the source SHA-256 and canonical model; missing fields fail closed instead of being fabricated.",
    testingResponsibility: "HooshyarOS owns the focused XML extraction and unsafe-XML rejection tests.",
    upgradeResponsibility: "Extend the internal extractor directly; no third-party dependency is involved.",
    deprecationHandling: "The extractor is an internal capability and can be replaced without changing the canonical adapter.",
    reason: "Safe XML text/element extraction is achievable with bounded Node built-ins; a full XML engine is not justified for the canonical ledger contract.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "text-tsv-internal",
    capability: "text.tsv.parse",
    provider: "HooshyarOS canonical delimiter parser (Node built-ins only)",
    purpose: "Parse tab-delimited ledgers through the same canonical validation/normalization pipeline as CSV.",
    reuseTier: "INTERNAL_CAPABILITY",
    status: "APPROVED",
    integration: "INTEGRATED",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    securityConsiderations: "Reuses the canonical row/amount/date validation; no formula evaluation, no code execution and no parallel spreadsheet architecture.",
    replaceableVia: "FinancialDataIngestionAdapter.ingestTsv + parseAndValidate(delimiter)",
    provenanceResponsibility: "HooshyarOS owns the source SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS owns the focused TSV ingestion tests.",
    upgradeResponsibility: "Extend the canonical delimiter parser directly; no third-party dependency is involved.",
    deprecationHandling: "The delimiter parser is part of the canonical owner and evolves with it.",
    reason: "TSV differs from CSV only by delimiter, so it must reuse the canonical CSV pipeline rather than introduce a new dependency or parser.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "data-rest-generic-api",
    capability: "data.rest.graphql",
    provider: "GenericApiConnector (Node fetch)",
    purpose: "Canonical read contract for tenant REST/JSON endpoints (pagination, rate limiting, retry, secret redaction).",
    reuseTier: "INTERNAL_CAPABILITY",
    status: "APPROVED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "Injects tenant auth strategy, redacts auth/token/key/secret headers, and never logs secret values; transport is injectable for tests.",
    replaceableVia: "Product/GenericApiConnector.ts + Product/CredentialVault.ts",
    provenanceResponsibility: "HooshyarOS owns response validation, canonical mapping and raw-source evidence.",
    testingResponsibility: "HooshyarOS owns the connector tests with injected transport.",
    upgradeResponsibility: "Reuse the existing connector; extend its config rather than forking a new connector.",
    deprecationHandling: "The connector is the stable boundary; concrete tenant adapters remain replaceable.",
    reason: "A canonical generic acquisition connector already exists. Future API integrations must reuse it instead of building a new connector.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "data-db-generic",
    capability: "data.database.access",
    provider: "GenericDbConnector (caller-supplied read-only driver)",
    purpose: "Canonical read-only database acquisition contract that rejects writes and maps rows to canonical records.",
    reuseTier: "INTERNAL_CAPABILITY",
    status: "APPROVED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "Rejects write/DDL/transaction-control queries and caps rows; no real driver is bundled, so credentials and drivers stay caller-owned.",
    replaceableVia: "Product/GenericDbConnector.ts",
    provenanceResponsibility: "HooshyarOS owns query validation, row mapping and provenance.",
    testingResponsibility: "HooshyarOS owns the DB connector tests with stub drivers.",
    upgradeResponsibility: "Reuse the existing connector; add a driver behind it rather than a parallel connector.",
    deprecationHandling: "The contract is stable; concrete drivers remain replaceable.",
    reason: "A canonical read-only DB boundary exists. Future database acquisitions must supply a driver behind it, not build a competing connector.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "data-sftp",
    capability: "data.sftp",
    provider: "SSH/SFTP (IETF SSH protocol family)",
    purpose: "Scheduled enterprise file delivery from customer SFTP servers.",
    reuseTier: "INDUSTRY_STANDARD",
    status: "CANDIDATE",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "Host-key verification, least-privilege credentials via CredentialVault, and no plaintext secret logging would be mandatory.",
    replaceableVia: "planned acquisition connector under Product/, converging on the canonical normalization/validation/provenance pipeline",
    unmetConditions: [
      "Confirm a real customer/enterprise requirement before integrating.",
      "Admit a maintained SSH/SFTP client provider with license, maintenance and security evidence.",
    ],
    reason: "A common enterprise channel, but no confirmed customer workflow currently requires it; architecture target recorded so it converges on canonical contracts when needed.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "identity-federated-auth",
    capability: "identity.federated-auth",
    provider: "OAuth 2.0 / OpenID Connect",
    purpose: "Enterprise SSO / federated identity for commercial tenants.",
    reuseTier: "INDUSTRY_STANDARD",
    status: "CANDIDATE",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "Identity policy, session ownership, tenant boundaries and authorization stay HooshyarOS-canonical; only the token protocol would be provided.",
    replaceableVia: "existing authentication boundary (Auth/) behind a provider adapter",
    unmetConditions: [
      "Confirm a customer SSO requirement and the approved identity provider.",
      "Admit the protocol implementation provider with license, maintenance and security evidence.",
    ],
    reason: "Identity protocols are standardized; HooshyarOS must not hand-roll them, but no customer requirement is confirmed yet.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "enterprise-erp-accounting",
    capability: "enterprise.erp.accounting",
    provider: "vendor export interfaces (CSV/JSON, REST, read-only DB)",
    purpose: "Acquire financial data from ERP/accounting systems through their supported interfaces.",
    reuseTier: "ADAPTER_PROVIDER",
    status: "CANDIDATE",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "Read-only acquisition, tenant-scoped credentials and no per-connector intelligence; every path converges on canonical validation and provenance.",
    replaceableVia: "Product/GenericApiConnector.ts / Product/GenericDbConnector.ts / acquisition routes behind one canonical normalization path",
    unmetConditions: [
      "Prioritize the first real ERP/accounting integration from customer evidence.",
      "Define the vendor export profile and admit its transport provider.",
    ],
    reason: "High commercial leverage, but selection must follow a confirmed customer and converge on canonical contracts; no vendor is chosen speculatively.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },

  // ---------------------------------------------------------------------------
  // Multi-format input families evaluated for canonical acquisition. Entries
  // below are DEFERRED with explicit evidence and unmet conditions; none of them
  // is claimed as supported. Adding a format requires an admitted provider and
  // focused canonical-routing tests, never a detection-only claim.
  // ---------------------------------------------------------------------------
  {
    capabilityId: "document-xls-legacy",
    capability: "document.xls.parse",
    provider: "unspecified (Legacy OLE2 BIFF workbook reader)",
    purpose: "Read legacy binary .xls workbooks into the canonical ledger pipeline.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "Legacy OLE2 parsing must be bounded against malformed compound files and formula evaluation; no provider currently meets the hardened bar set by exceljs-hardened.",
    replaceableVia: "FinancialDataIngestionAdapter XLS route (currently fail-closed)",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS would own focused XLS tests; no PASS without a real reader.",
    upgradeResponsibility: "Any admitted reader would be pinned and re-verified.",
    deprecationHandling: "Route through the existing canonical XLSX/spreadsheet boundary once admitted.",
    unmetConditions: [
      "Admit a maintained, commercially compatible .xls reader with hardened malformed-input behavior.",
      "Prove formula values only are read and no macro executes.",
      "Add focused XLS tests through the canonical adapter.",
    ],
    reason: "exceljs-hardened is the admitted XLSX provider and does not read the legacy OLE2 .xls format; no substitute reader has passed the hardened admission bar.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "document-rtf-text",
    capability: "document.rtf.text",
    provider: "unspecified RTF text extractor",
    purpose: "Extract text/tables from RTF documents.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "RTF can embed objects and control words; extraction must be bounded and must not execute embedded content.",
    replaceableVia: "planned adapter behind DocxAcquisition-style canonical boundary",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS would own focused RTF tests.",
    upgradeResponsibility: "Any admitted provider would be pinned and re-verified.",
    deprecationHandling: "Replace behind the document-acquisition boundary.",
    unmetConditions: [
      "Admit a maintained, commercially compatible RTF text provider with license and maintenance evidence.",
      "Prove safe handling of embedded objects.",
    ],
    reason: "No RTF provider is currently declared or admitted; deferring avoids introducing an ungoverned dependency.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "document-odt-text",
    capability: "document.odt.text",
    provider: "unspecified ODF text extractor",
    purpose: "Extract text/tables from OpenDocument Text (.odt) files.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "ODF is a ZIP container; extraction must keep the zip-bomb limits already used for XLSX/DOCX.",
    replaceableVia: "planned adapter behind the canonical document boundary",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS would own focused ODT tests.",
    upgradeResponsibility: "Any admitted provider would be pinned and re-verified.",
    deprecationHandling: "Replace behind the document-acquisition boundary.",
    unmetConditions: [
      "Admit a maintained, commercially compatible ODF text provider.",
      "Reuse the canonical zip-bomb resource limits.",
    ],
    reason: "No ODT provider is currently declared or admitted.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "presentation-pptx-text",
    capability: "presentation.pptx.text",
    provider: "unspecified OOXML presentation reader",
    purpose: "Extract slide text/tables from PPTX presentations.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "OOXML ZIP container; must reuse the zip-bomb limits and never execute embedded macros or OLE objects.",
    replaceableVia: "planned adapter behind the canonical document boundary",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS would own focused PPTX tests.",
    upgradeResponsibility: "Any admitted provider would be pinned and re-verified.",
    deprecationHandling: "Replace behind the document-acquisition boundary.",
    unmetConditions: [
      "Confirm a real customer workflow that requires PPTX acquisition.",
      "Admit a maintained, commercially compatible OOXML presentation provider.",
    ],
    reason: "No confirmed customer requirement and no admitted provider; deferring avoids a speculative dependency.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "document-epub",
    capability: "document.ebook.epub",
    provider: "unspecified EPUB reader",
    purpose: "Extract text/tables from EPUB publications.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "EPUB is a ZIP container with HTML/XHTML content; extraction must reuse the existing HTML safety rules and zip limits.",
    replaceableVia: "planned adapter reusing MarkupTextExtraction safely",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS would own focused EPUB tests.",
    upgradeResponsibility: "Any admitted provider would be pinned and re-verified.",
    deprecationHandling: "Replace behind the document-acquisition boundary.",
    unmetConditions: [
      "Confirm a real customer workflow that requires EPUB acquisition.",
      "Admit a maintained, commercially compatible EPUB container provider.",
    ],
    reason: "Not part of the primary financial-document input set; deferred until customer evidence justifies it.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "mail-eml",
    capability: "mail.eml.parse",
    provider: "unspecified RFC 5322 MIME parser",
    purpose: "Acquire ledger attachments and/or body text from .eml mail files.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "MIME parsing must not fetch remote content, must bound attachment extraction and must never execute attachments.",
    replaceableVia: "planned adapter reusing the canonical attachment acquisition routes",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS would own focused EML tests.",
    upgradeResponsibility: "Any admitted provider would be pinned and re-verified.",
    deprecationHandling: "Replace behind the mail-acquisition boundary.",
    unmetConditions: [
      "Confirm a real customer workflow that requires mail acquisition.",
      "Admit a maintained, commercially compatible MIME provider with no network fetch.",
    ],
    reason: "Mail ingestion is valuable for enterprise onboarding but no customer workflow is confirmed; deferring avoids a speculative dependency.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "mail-msg",
    capability: "mail.msg.parse",
    provider: "unspecified Outlook MSG (OLE2 CFB) parser",
    purpose: "Acquire attachments/body from Outlook .msg files.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "OLE2 compound-file parsing must be bounded and must never execute embedded objects.",
    replaceableVia: "planned adapter behind the mail-acquisition boundary",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS would own focused MSG tests.",
    upgradeResponsibility: "Any admitted provider would be pinned and re-verified.",
    deprecationHandling: "Replace behind the mail-acquisition boundary.",
    unmetConditions: [
      "Confirm a real customer workflow that requires MSG acquisition.",
      "Admit a maintained, commercially compatible CFB/MSG provider.",
    ],
    reason: "No confirmed customer requirement and no admitted provider.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "database-dbf",
    capability: "database.dbf.parse",
    provider: "unspecified dBASE/DBF reader",
    purpose: "Acquire legacy DBF tables into the canonical ledger pipeline.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "DBF is a plain binary table format; parsing must be bounded by row/column limits and must not infer a schema beyond the canonical ledger contract.",
    replaceableVia: "planned adapter reusing the canonical tabular normalization path",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS would own focused DBF tests.",
    upgradeResponsibility: "Any admitted provider would be pinned and re-verified.",
    deprecationHandling: "Replace behind the tabular-acquisition boundary.",
    unmetConditions: [
      "Confirm a real customer workflow that requires DBF acquisition.",
      "Admit a maintained, commercially compatible DBF provider.",
    ],
    reason: "Legacy format with no confirmed requirement; deferred.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "document-yaml",
    capability: "document.yaml.parse",
    provider: "unspecified YAML parser",
    purpose: "Treat YAML ledgers as structured input.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "YAML parsers have a history of unsafe type construction; any parser must use a safe schema and never construct arbitrary objects.",
    replaceableVia: "planned adapter mapping YAML into the canonical STRUCTURED/JSON contract",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS would own focused YAML tests.",
    upgradeResponsibility: "If admitted, the parser would be pinned and re-verified.",
    deprecationHandling: "YAML would map onto the existing structured ingestion contract.",
    unmetConditions: [
      "Confirm a real customer workflow that supplies YAML ledgers.",
      "Admit a safe-schema YAML parser as a declared dependency.",
    ],
    reason: "JSON already covers the primary structured input; YAML is not declared and no unsafe parser will be admitted implicitly.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "image-tiff-decode",
    capability: "image.tiff.decode",
    provider: "unspecified TIFF decoder",
    purpose: "Acquire TIFF/TIF scanned documents for OCR.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "Image decoding of untrusted TIFF must be bounded against malformed/decompression-bomb inputs.",
    replaceableVia: "Product/ImageAcquisition.ts (extend the canonical image boundary)",
    provenanceResponsibility: "HooshyarOS would own the original-byte SHA-256.",
    testingResponsibility: "HooshyarOS would own focused TIFF tests.",
    upgradeResponsibility: "Any admitted decoder would be pinned and re-verified.",
    deprecationHandling: "Extend the existing image-acquisition boundary.",
    unmetConditions: [
      "Confirm a real customer workflow that supplies TIFF scans.",
      "Admit a maintained, commercially compatible TIFF decoder with decompression-bomb limits.",
    ],
    reason: "PNG/JPEG already cover the common scan cases; TIFF has no confirmed requirement and no admitted decoder.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "document-broad-tika",
    capability: "document.broad.parse",
    provider: "Apache Tika (self-hosted)",
    purpose: "Optional broad document-format fallback for long-tail formats.",
    reuseTier: "ADAPTER_PROVIDER",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "A Java service parsing untrusted documents is a large attack surface; it would require isolation, resource limits and no outbound network.",
    replaceableVia: "an adapter that lowers Tika output into the canonical acquisition contracts (Tika may never own canonical models)",
    provenanceResponsibility: "HooshyarOS would own all canonical models and provenance; Tika would only supply parsed bytes.",
    testingResponsibility: "HooshyarOS would own adapter-boundary tests plus a real Tika integration test.",
    upgradeResponsibility: "Any Tika version would be pinned and re-verified.",
    deprecationHandling: "Formats would be moved to direct providers; Tika is never a mandatory runtime.",
    unmetConditions: [
      "Demonstrate a concrete format gap that direct providers cannot cover.",
      "Justify the JVM runtime, deployment footprint, isolation and operational maintenance.",
      "Provide license/licence-evidence and a versioned self-hosted deployment contract.",
    ],
    reason: "Tika would materially increase the deployment footprint (JVM) and operational/security surface; the current direct-provider set covers the primary commercial input families without it.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "office-libreoffice-convert",
    capability: "document.broad.parse",
    provider: "LibreOffice headless conversion",
    purpose: "Optional legacy/office conversion fallback (for example .doc or difficult office inputs).",
    reuseTier: "ADAPTER_PROVIDER",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    securityConsiderations: "Running an office suite against untrusted documents is a high-risk attack surface requiring sandboxing and resource/time limits.",
    replaceableVia: "an adapter that converts to an already-supported format, then flows through the canonical routes",
    provenanceResponsibility: "HooshyarOS would own all canonical models and provenance; converted intermediate output would be transient only.",
    testingResponsibility: "HooshyarOS would own adapter-boundary tests plus a real conversion test.",
    upgradeResponsibility: "Any deployment would be pinned and re-verified.",
    deprecationHandling: "Direct providers remain preferred; LibreOffice never becomes mandatory.",
    unmetConditions: [
      "Demonstrate a concrete format gap that a lighter direct provider cannot cover.",
      "Justify the deployment, sandboxing and operational maintenance footprint.",
    ],
    reason: "No confirmed conversion gap requires it, and a headless office suite is a heavy, high-risk dependency; DOCX is covered directly by the admitted mammoth provider.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
];
