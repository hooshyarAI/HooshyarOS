/**
 * Capability Provider Leverage — focused governance tests.
 *
 * These tests prove the reuse/admission mechanism is executable and truthful:
 * they evaluate admission fail-closed, select providers by the canonical order,
 * and audit the governed inventory against the repository's real declared
 * dependencies and installed licenses.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  CAPABILITY_PROVIDER_ERROR_CODES,
  CapabilityProviderRegistry,
  HOOSHYAROS_CAPABILITY_PROVIDER_INVENTORY,
  REUSE_EVALUATION_ORDER,
  assessProvider,
  type CapabilityProviderCandidate,
  type DependencySnapshot,
} from "../Product/CapabilityProviderRegistry";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");

function loadRealDependencySnapshot(): DependencySnapshot {
  const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const names = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const snapshot = new Map<string, { version: string; license?: string }>();
  for (const name of names) {
    const depPkgPath = resolve(REPO_ROOT, "node_modules", name, "package.json");
    if (!existsSync(depPkgPath)) continue;
    const depPkg = JSON.parse(readFileSync(depPkgPath, "utf8")) as { version?: string; license?: string };
    snapshot.set(name, {
      version: String(depPkg.version ?? "unknown"),
      license: typeof depPkg.license === "string" ? depPkg.license : undefined,
    });
  }
  return snapshot;
}

function admittedLibrary(overrides: Partial<CapabilityProviderCandidate> = {}): CapabilityProviderCandidate {
  return {
    capabilityId: "synthetic-lib",
    capability: "document.pdf.text",
    provider: "synthetic-lib",
    purpose: "Synthetic provider used only to exercise admission rules.",
    reuseTier: "MATURE_LIBRARY",
    status: "APPROVED",
    integration: "INTEGRATED",
    declaredDependency: "synthetic-lib",
    license: "MIT",
    licenseEvidence: "unit-test fixture",
    commercialUseCompatible: true,
    selfHostedOffline: true,
    maintenance: { source: "unit-test fixture", asOf: "2026-09-19", note: "fixture" },
    securityConsiderations: "fixture",
    replaceableVia: "fixture-boundary",
    provenanceResponsibility: "HooshyarOS",
    testingResponsibility: "HooshyarOS",
    upgradeResponsibility: "HooshyarOS",
    deprecationHandling: "replace behind fixture-boundary",
    reason: "fixture",
    decidedBy: "test",
    decidedAt: "2026-09-19",
    ...overrides,
  };
}

describe("CapabilityProviderRegistry — governed reuse/admission", () => {
  test("canonical evaluation order matches the leverage strategy", () => {
    expect(REUSE_EVALUATION_ORDER).toEqual([
      "INDUSTRY_STANDARD",
      "MATURE_LIBRARY",
      "INTERNAL_CAPABILITY",
      "ADAPTER_PROVIDER",
      "NATIVE_IMPLEMENTATION",
    ]);
  });

  test("every APPROVED inventory entry is fully admissible (no half-declared approval)", () => {
    const registry = new CapabilityProviderRegistry();
    for (const candidate of HOOSHYAROS_CAPABILITY_PROVIDER_INVENTORY) {
      if (candidate.status !== "APPROVED") continue;
      const assessment = assessProvider(candidate);
      expect({ id: candidate.capabilityId, reasons: assessment.reasons }).toEqual({
        id: candidate.capabilityId,
        reasons: [],
      });
      expect(assessment.admitted).toBe(true);
    }
  });

  test("non-approved entries are never admissible and expose their unmet conditions", () => {
    const registry = new CapabilityProviderRegistry();
    for (const candidate of HOOSHYAROS_CAPABILITY_PROVIDER_INVENTORY) {
      if (candidate.status === "APPROVED") continue;
      const assessment = registry.assess(candidate.capabilityId);
      expect(assessment.admitted).toBe(false);
      expect(assessment.reasons).toContain(`status-not-approved:${candidate.status}`);
    }
    expect(registry.assess("document-xls-legacy").requiredActions.length).toBeGreaterThan(0);
  });

  test("fails closed when an external provider has no verified license", () => {
    const assessment = assessProvider(admittedLibrary({ license: undefined }));
    expect(assessment.admitted).toBe(false);
    expect(assessment.reasons).toContain("license-missing");
  });

  test("fails closed when commercial-use compatibility is not confirmed", () => {
    const assessment = assessProvider(admittedLibrary({ commercialUseCompatible: false }));
    expect(assessment.admitted).toBe(false);
    expect(assessment.reasons).toContain("commercial-use-not-confirmed");
  });

  test("requires evidence that reuse was assessed before a native implementation", () => {
    const assessment = assessProvider(
      admittedLibrary({ reuseTier: "NATIVE_IMPLEMENTATION", nativeFallbackCriteria: undefined }),
    );
    expect(assessment.admitted).toBe(false);
    expect(assessment.reasons).toContain("native-fallback-criteria-missing");
  });

  test("requires an integrated library to name its declared dependency", () => {
    const assessment = assessProvider(admittedLibrary({ declaredDependency: undefined }));
    expect(assessment.admitted).toBe(false);
    expect(assessment.reasons).toContain("declared-dependency-missing");
  });

  test("selects the admitted integrated provider for text-native PDF", () => {
    const registry = new CapabilityProviderRegistry();
    expect(registry.selectProvider("document.pdf.text").capabilityId).toBe("pdf-text-native");
  });

  test("selects the admitted integrated OCR provider for scanned PDFs", () => {
    const registry = new CapabilityProviderRegistry();
    const provider = registry.selectProvider("document.pdf.ocr");
    expect(provider.capabilityId).toBe("pdf-ocr-tesseract");
    expect(provider.integration).toBe("INTEGRATED");
    expect(provider.selfHostedOffline).toBe(true);
  });

  test("fails closed when the only provider for a capability is deferred (legacy XLS)", () => {
    const registry = new CapabilityProviderRegistry();
    expect(() => registry.selectProvider("document.xls.parse"))
      .toThrow(`${CAPABILITY_PROVIDER_ERROR_CODES.NOT_ADMITTED}:document.xls.parse`);
  });

  test("selection prefers the earliest admissible reuse tier", () => {
    const registry = new CapabilityProviderRegistry([
      admittedLibrary({ capabilityId: "later-library", capability: "encoding.text.decode", reuseTier: "MATURE_LIBRARY" }),
      admittedLibrary({ capabilityId: "earlier-standard", capability: "encoding.text.decode", reuseTier: "INDUSTRY_STANDARD" }),
    ]);
    expect(registry.selectProvider("encoding.text.decode").capabilityId).toBe("earlier-standard");
  });

  test("registration fails closed on duplicates and malformed entries", () => {
    const registry = new CapabilityProviderRegistry([]);
    const candidate = admittedLibrary();
    registry.register(candidate);
    expect(() => registry.register(candidate)).toThrow(CAPABILITY_PROVIDER_ERROR_CODES.ALREADY_REGISTERED);
    expect(() => registry.register(admittedLibrary({ capabilityId: "  " })))
      .toThrow(CAPABILITY_PROVIDER_ERROR_CODES.CAPABILITY_REQUIRED);
    expect(() => registry.register(admittedLibrary({ capabilityId: "no-boundary", replaceableVia: "" })))
      .toThrow(CAPABILITY_PROVIDER_ERROR_CODES.BOUNDARY_REQUIRED);
    expect(() => registry.getById("missing")).toThrow(CAPABILITY_PROVIDER_ERROR_CODES.UNKNOWN);
  });

  test("inventory metadata matches the repository's real declared dependencies and installed licenses", () => {
    const registry = new CapabilityProviderRegistry();
    const result = registry.auditDeclaredDependencies(loadRealDependencySnapshot());
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checked).toBeGreaterThanOrEqual(3);
  });

  test("dependency audit detects undeclared dependencies and license mismatches", () => {
    const registry = new CapabilityProviderRegistry([
      admittedLibrary({ capabilityId: "missing-dep", declaredDependency: "absent-package", license: "MIT" }),
      admittedLibrary({ capabilityId: "wrong-license", capability: "spreadsheet.xlsx.parse", declaredDependency: "present-package", license: "MIT" }),
    ]);
    const snapshot: DependencySnapshot = new Map([
      ["present-package", { version: "1.0.0", license: "Apache-2.0" }],
    ]);
    const result = registry.auditDeclaredDependencies(snapshot);

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ capabilityId: "missing-dep", kind: "missing-declared-dependency" }),
        expect.objectContaining({ capabilityId: "wrong-license", kind: "license-mismatch" }),
      ]),
    );
  });
});
