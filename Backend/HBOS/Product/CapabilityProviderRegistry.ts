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
  | "document.docx.text"
  | "spreadsheet.xlsx.parse"
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
      "Provide a production PDF-page rasterizer through an admitted provider; the rasterizePage hook is currently test-injected only.",
      "Prove a commercial-use-compatible, size-bounded path with focused OCR tests before routing scanned PDFs.",
    ],
    reason: "OCR is the honest remaining PDF limitation. No provider is admitted yet; installing one without satisfying admission criteria would violate the leverage law.",
    decidedBy: "hooshyaros-governance",
    decidedAt: "2026-09-19",
  },
  {
    capabilityId: "document-docx-mammoth",
    capability: "document.docx.text",
    provider: "mammoth",
    purpose: "Extract plain text from DOCX documents for canonical ingestion.",
    reuseTier: "MATURE_LIBRARY",
    status: "DEFERRED",
    integration: "NOT_INTEGRATED",
    declaredDependency: "mammoth",
    license: "BSD-2-Clause",
    licenseEvidence: "package.json#dependencies + node_modules/mammoth/package.json#license (verified 2026-09-19)",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    maintenance: {
      source: "package.json#dependencies + node_modules/mammoth/package.json (installed 1.12.2)",
      asOf: "2026-09-19",
      note: "Presence, pinned version and license verified in-repo; the helper exists but the canonical owner does not route DOCX.",
    },
    securityConsiderations: "Parses untrusted ZIP-based documents in-process; routing must bound size and reject legacy DOC explicitly.",
    replaceableVia: "Product/DocxAcquisition.ts",
    provenanceResponsibility: "HooshyarOS owns the original-byte SHA-256 and canonical model.",
    testingResponsibility: "HooshyarOS owns the DOCX acquisition tests.",
    upgradeResponsibility: "Deferred; upgrades would re-run DOCX acquisition tests.",
    deprecationHandling: "Replace behind the DOCX acquisition boundary.",
    unmetConditions: [
      "Enable DOCX routing in the canonical ingestion owner with focused tests.",
      "Confirm that DOCX text maps to the canonical ledger schema or add a documented mapping.",
    ],
    reason: "The helper and declared dependency already exist, but the canonical owner intentionally does not route DOCX yet; admission is deferred rather than claimed.",
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
];
