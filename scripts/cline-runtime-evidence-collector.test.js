const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { execFileSync, spawnSync } = cp;

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "final-product-factory.yml");
const COLLECTOR_PATH = path.join(ROOT, "scripts", "cline-runtime-evidence-collector.cjs");
const EVIDENCE_SCRIPT_PATH = path.join(ROOT, "scripts", "android-acceptance-evidence.cjs");

describe("runtime evidence collector CI regression", () => {
  let tempDir;
  let sha;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(ROOT, ".hooshyar", "ci-regression-test-"));
    execFileSync("git", ["init"], { cwd: tempDir, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "ci@hooshyar.com"], { cwd: tempDir, stdio: "pipe" });
    execFileSync("git", ["config", "user.name", "CI"], { cwd: tempDir, stdio: "pipe" });
    execFileSync("git", ["commit", "--allow-empty", "-m", "regression baseline"], { cwd: tempDir, stdio: "pipe" });
    sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tempDir, encoding: "utf8" }).trim();
    fs.mkdirSync(path.join(tempDir, ".hooshyar"), { recursive: true });
  });

  afterAll(() => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  test("workflow downloads evidence artifacts to the workspace root so the collector finds them at .hooshyar/<name>.json", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8").replace(/\r\n/g, "\n");
    // artifact payloads carry the internal path .hooshyar/<name>.json (upload path);
    // actions/download-artifact@v4 preserves that internal structure, so the download
    // destination must be the workspace root (".") so the final path is .hooshyar/<name>.json.
    // A download destination of ".hooshyar" nests the path at .hooshyar/.hooshyar/<name>.json
    // and the collector (which reads .hooshyar/<name>.json) would never find it.
    expect(workflow).toContain("path: .\n");
    expect(workflow).not.toContain("path: .hooshyar\n");
    // sanity: each evidence artifact is downloaded exactly once into the workspace root
    // (download paths are bare "path: ." while upload paths are "path: ./<name>")
    expect(workflow.match(/path: \.\n/g).length).toBe(4);
  });

  test("evidence collector returns QUALIFICATION_COMPLETE when all evidence is present, valid and commit-bound", () => {
    const fixtures = {
      "factory-success.json": JSON.stringify({
        type: "FINAL_PRODUCT_FACTORY_SUCCESS", version: 1, status: "PASS", commit: sha,
        acceptance: ["runtime-health", "full-jest"], fullJest: "PASS",
      }),
      "web-acceptance-success.json": JSON.stringify({
        type: "WEB_PRODUCT_ACCEPTANCE_SUCCESS", version: 8, status: "PASS", commit: sha,
        acceptance: ["root", "health"],
      }),
      "security-acceptance-success.json": JSON.stringify({
        type: "SECURITY_TENANT_ACCEPTANCE_SUCCESS", version: 4, status: "PASS", commit: sha,
        acceptance: ["unauthenticated-dashboard-denied"],
      }),
      "android-acceptance-success.json": JSON.stringify({
        type: "ANDROID_PRODUCT_ACCEPTANCE_SUCCESS", version: 1, status: "PASS", commit: sha,
        acceptance: [
          "apk-present", "device-online", "android-booted", "package-manager-ready",
          "apk-installed", "launcher-start", "process-alive", "main-activity-visible",
        ],
      }),
    };
    for (const [name, content] of Object.entries(fixtures)) {
      fs.writeFileSync(path.join(tempDir, ".hooshyar", name), content);
    }
    const result = spawnSync("node", [COLLECTOR_PATH], { cwd: tempDir, encoding: "utf8" });
    const evidence = JSON.parse(result.stdout);
    expect(result.status).toBe(0);
    expect(evidence.verdict).toBe("QUALIFICATION_COMPLETE");
    expect(evidence.ciFeedback.status).toBe("PASS");
    for (const cell of Object.values(evidence.cells)) expect(cell).toBe("PASS");
  });

  test("evidence collector stays fail-closed when evidence is stale (commit mismatch) or missing", () => {
    // wrong-commit evidence -> cells should report REQUIRES_EXECUTION / REQUIRES_DEVICE_EXECUTION
    fs.writeFileSync(path.join(tempDir, ".hooshyar/factory-success.json"), JSON.stringify({
      type: "FINAL_PRODUCT_FACTORY_SUCCESS", version: 1, status: "PASS", commit: "0000000000000000000000000000000000000000",
      acceptance: ["runtime-health"], fullJest: "PASS",
    }));
    const stale = spawnSync("node", [COLLECTOR_PATH], { cwd: tempDir, encoding: "utf8" });
    const staleEvidence = JSON.parse(stale.stdout);
    expect(staleEvidence.verdict).toBe("REQUIRES_ADDITIONAL_EVIDENCE");
    expect(staleEvidence.cells["win-core"]).toBe("REQUIRES_EXECUTION");
    expect(staleEvidence.cells["full-suite"]).toBe("REQUIRES_EXECUTION");
    expect(stale.status).toBe(1);

    // remove evidence entirely -> missing files also fail closed
    fs.rmSync(path.join(tempDir, ".hooshyar", "factory-success.json"), { force: true });
    const missing = spawnSync("node", [COLLECTOR_PATH], { cwd: tempDir, encoding: "utf8" });
    const missingEvidence = JSON.parse(missing.stdout);
    expect(missingEvidence.verdict).toBe("REQUIRES_ADDITIONAL_EVIDENCE");
    expect(missingEvidence.cells["win-core"]).toBe("REQUIRES_EXECUTION");
    expect(missing.status).toBe(1);
  });

  test("collector path contract matches android evidence script's canonical evidence path", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    const evidenceScript = fs.readFileSync(EVIDENCE_SCRIPT_PATH, "utf8");
    // The canonical android evidence artifact is written by the harness to .hooshyar/android-acceptance-success.json.
    // With the download destination fixed to the workspace root, the artifact lands at that exact path.
    expect(evidenceScript).toContain("DEFAULT_EVIDENCE_PATH = path.join(ROOT, '.hooshyar', 'android-acceptance-success.json')");
    expect(workflow).toContain('name: hooshyar-android-product-acceptance-evidence');
  });
});
