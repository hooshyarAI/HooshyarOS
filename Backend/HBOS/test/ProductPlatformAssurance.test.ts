import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Manifest = {
  schemaVersion: string;
  product: string;
  completionRule: string;
  layers: Array<{ id: string; name: string }>;
  environments: string[];
  releaseEvidence: string[];
  criticalBlockers: string[];
};

type Matrix = {
  schemaVersion: string;
  rule: string;
  required: Array<{
    id: string;
    capability: string;
    environment: string;
    workflow: string;
    evidence: string;
  }>;
  completion: {
    productComplete: boolean;
    requiredStatuses: Record<string, string>;
  };
};

const readJson = <T>(relativePath: string): T => JSON.parse(
  readFileSync(resolve(process.cwd(), relativePath), "utf8"),
) as T;

describe("Product platform assurance contract", () => {
  test("manifest and qualification matrix are present, coherent, and fail-closed", () => {
    const manifest = readJson<Manifest>("Docs/Product/PRODUCT_PLATFORM_MANIFEST.json");
    const matrix = readJson<Matrix>("Docs/Product/PRODUCT_QUALIFICATION_MATRIX.json");

    expect(manifest.product).toBe("HooshyarOS");
    expect(manifest.schemaVersion).toBe("1.0");
    expect(manifest.layers.length).toBeGreaterThanOrEqual(8);
    expect(new Set(manifest.layers.map(layer => layer.id)).size).toBe(manifest.layers.length);
    expect(manifest.environments).toEqual(expect.arrayContaining(["windows", "web", "android"]));
    expect(manifest.releaseEvidence).toEqual(expect.arrayContaining(["runtime", "application", "acceptance", "ci"]));

    expect(matrix.schemaVersion).toBe("1.0");
    expect(matrix.required.length).toBeGreaterThanOrEqual(10);
    expect(new Set(matrix.required.map(cell => cell.id)).size).toBe(matrix.required.length);
    for (const cell of matrix.required) {
      expect(cell.capability).toBeTruthy();
      expect(cell.environment).toBeTruthy();
      expect(cell.workflow).toBeTruthy();
      expect(cell.evidence).toBeTruthy();
    }

    expect(matrix.completion.productComplete).toBe(false);
    expect(matrix.completion.requiredStatuses).toMatchObject({
      PASS: "required",
      BLOCKED: "release-blocking",
      FAIL: "release-blocking",
      UNKNOWN: "release-blocking",
    });
  });
});
