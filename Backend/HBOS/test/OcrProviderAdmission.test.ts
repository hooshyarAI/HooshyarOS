/**
 * OCR provider admission evidence tests.
 *
 * Proves, from the real installed packages, that the OCR provider recorded as
 * `pdf-ocr-tesseract` in the canonical inventory actually satisfies the
 * leverage-law admission conditions: a declared dependency, a verifiable
 * commercially-compatible license, offline/self-hosted language data and a
 * bounded, integrated route.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  CapabilityProviderRegistry,
  assessProvider,
  type DependencySnapshot,
} from "../Product/CapabilityProviderRegistry";
import { resolveOfflineOcrLangPath } from "../Product/OcrAdapter";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const NODE_MODULES = join(REPO_ROOT, "node_modules");

interface InstalledPackage {
  readonly version?: string;
  readonly license?: string;
  readonly dependencies?: Record<string, string>;
}

function readInstalledPackage(name: string): InstalledPackage {
  return JSON.parse(readFileSync(join(NODE_MODULES, name, "package.json"), "utf8")) as InstalledPackage;
}

function realDependencySnapshot(): DependencySnapshot {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const names = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ]);
  const snapshot = new Map<string, { version: string; license?: string }>();
  for (const name of names) {
    const path = join(NODE_MODULES, name, "package.json");
    if (!existsSync(path)) continue;
    const installed = JSON.parse(readFileSync(path, "utf8")) as InstalledPackage;
    snapshot.set(name, {
      version: String(installed.version ?? "unknown"),
      license: typeof installed.license === "string" ? installed.license : undefined,
    });
  }
  return snapshot;
}

describe("OCR provider admission (tesseract.js)", () => {
  test("the OCR provider is approved, integrated, offline and declared", () => {
    const registry = new CapabilityProviderRegistry();
    const candidate = registry.getById("pdf-ocr-tesseract");

    expect(candidate.capability).toBe("document.pdf.ocr");
    expect(candidate.reuseTier).toBe("MATURE_LIBRARY");
    expect(candidate.status).toBe("APPROVED");
    expect(candidate.integration).toBe("INTEGRATED");
    expect(candidate.declaredDependency).toBe("tesseract.js");
    expect(candidate.selfHostedOffline).toBe(true);
    expect(candidate.commercialUseCompatible).toBe(true);
    expect(assessProvider(candidate).admitted).toBe(true);
    expect(registry.selectProvider("document.pdf.ocr").capabilityId).toBe("pdf-ocr-tesseract");
  });

  test("the declared engine and language-data packages are installed with commercial-use licenses", () => {
    const declaration = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const dependencies = declaration.dependencies ?? {};
    expect(dependencies["tesseract.js"]).toBeDefined();
    expect(dependencies["@tesseract.js-data/eng"]).toBeDefined();
    expect(dependencies["@tesseract.js-data/fas"]).toBeDefined();

    const engine = readInstalledPackage("tesseract.js");
    const core = readInstalledPackage("tesseract.js-core");
    const persian = readInstalledPackage("@tesseract.js-data/fas");
    const english = readInstalledPackage("@tesseract.js-data/eng");

    expect(engine.license).toBe("Apache-2.0");
    expect(core.license).toBe("Apache-2.0");
    // The redistributed language data packages are MIT over Apache-2.0
    // tessdata_fast data; both permit commercial use.
    expect(persian.license).toBe("MIT");
    expect(english.license).toBe("MIT");

    // The engine pins the WASM core it loads; both must be present and offline.
    expect(engine.dependencies?.["tesseract.js-core"]).toBeDefined();
    expect(existsSync(join(NODE_MODULES, "tesseract.js-core"))).toBe(true);
  });

  test("inventory dependency audit matches the real installed licenses", () => {
    const registry = new CapabilityProviderRegistry();
    const result = registry.auditDeclaredDependencies(realDependencySnapshot());
    expect(result.violations).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("OCR language data resolves to a local path, never a remote URL", () => {
    const langPath = resolveOfflineOcrLangPath("eng");
    expect(langPath).not.toMatch(/^https?:/);
    expect(existsSync(join(langPath, "eng.traineddata.gz"))).toBe(true);

    const combined = resolveOfflineOcrLangPath("fas+eng");
    expect(existsSync(join(combined, "fas.traineddata.gz"))).toBe(true);
    expect(existsSync(join(combined, "eng.traineddata.gz"))).toBe(true);
  });
});
