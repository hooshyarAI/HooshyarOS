const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const { execFileSync, spawnSync } = cp;

const ROOT = process.cwd();
const WORKFLOW_PATH = path.join(ROOT, ".github", "workflows", "final-product-factory.yml");
const COLLECTOR_PATH = path.join(ROOT, "scripts", "cline-runtime-evidence-collector.cjs");
const EVIDENCE_SCRIPT_PATH = path.join(ROOT, "scripts", "android-acceptance-evidence.cjs");
const MATRIX_PATH = path.join(ROOT, "Docs", "Product", "PRODUCT_QUALIFICATION_MATRIX.json");
const TEST_RUN_ID = 73142;

describe("runtime evidence collector CI regression", () => {
  let tempDir;
  let sha;

  function resetEvidenceDir() {
    fs.rmSync(path.join(tempDir, ".hooshyar"), { recursive: true, force: true });
    fs.mkdirSync(path.join(tempDir, ".hooshyar"), { recursive: true });
    // Every test owns an independent qualification matrix and evidence set.
    fs.rmSync(path.join(tempDir, "Docs"), { recursive: true, force: true });
  }

  function writeCanonicalMatrix() {
    const destination = path.join(tempDir, "Docs", "Product", "PRODUCT_QUALIFICATION_MATRIX.json");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(MATRIX_PATH, destination);
  }

  function writeEvidence(name, record) {
    fs.writeFileSync(
      path.join(tempDir, ".hooshyar", name),
      JSON.stringify(record, null, 2) + "\n",
      "utf8"
    );
  }

  function runCollector(env = {}) {
    return spawnSync("node", [COLLECTOR_PATH], {
      cwd: tempDir,
      encoding: "utf8",
      env: { ...process.env, GITHUB_RUN_ID: String(TEST_RUN_ID), ...env },
    });
  }

  function cell(evidence, id) {
    return evidence.cells.find((item) => item.id === id);
  }

  beforeAll(() => {
    // mkdtemp requires its parent to exist; do not depend on a previous test run.
    fs.mkdirSync(path.join(ROOT, ".hooshyar"), { recursive: true });
    tempDir = fs.mkdtempSync(path.join(ROOT, ".hooshyar", "ci-regression-test-"));
    execFileSync("git", ["init"], { cwd: tempDir, stdio: "pipe" });
    execFileSync("git", ["config", "user.email", "ci@hooshyar.com"], { cwd: tempDir, stdio: "pipe" });
    execFileSync("git", ["config", "user.name", "CI"], { cwd: tempDir, stdio: "pipe" });
    execFileSync("git", ["commit", "--allow-empty", "-m", "regression baseline"], { cwd: tempDir, stdio: "pipe" });
    sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: tempDir, encoding: "utf8" }).trim();
  });

  afterAll(() => {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  });

  test("workflow downloads all five evidence artifacts to the canonical directory and uploads hidden evidence explicitly", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8").replace(/\r\n/g, "\n");
    const downloads = [...workflow.matchAll(
      /- name: (Download [^\n]+)\n\s+uses: actions\/download-artifact@v\d+\n\s+continue-on-error: true\n\s+with:\n\s+name: ([^\n]+)\n\s+path: ([^\n]+)/g
    )].map((match) => ({
      step: match[1].trim(),
      name: match[2].trim(),
      path: match[3].trim(),
    }));

    expect(downloads).toEqual([
      { step: "Download Windows factory evidence", name: "hooshyar-final-product-factory-evidence", path: "./.hooshyar" },
      { step: "Download Web acceptance evidence", name: "hooshyar-web-product-acceptance-evidence", path: "./.hooshyar" },
      { step: "Download Android acceptance evidence", name: "hooshyar-android-product-acceptance-evidence", path: "./.hooshyar" },
      { step: "Download security acceptance evidence", name: "hooshyar-security-tenant-evidence", path: "./.hooshyar" },
      { step: "Download full-suite qualification evidence", name: "hooshyar-full-suite-evidence", path: "./.hooshyar" },
    ]);

    const requiredUploads = [
      ["hooshyar-web-product-acceptance-evidence", "web-acceptance-success.json"],
      ["hooshyar-security-tenant-evidence", "security-acceptance-success.json"],
      ["hooshyar-android-product-acceptance-evidence", "android-acceptance-success.json"],
      ["hooshyar-full-suite-evidence", "full-suite-success.json"],
      ["hooshyar-cline-runtime-evidence", "cline-runtime-evidence.json"],
    ];

    for (const [artifactName, filename] of requiredUploads) {
      const artifactNamePos = workflow.indexOf("name: " + artifactName);
      expect(artifactNamePos).toBeGreaterThanOrEqual(0);

      const uploadStart = workflow.lastIndexOf("uses: actions/upload-artifact@", artifactNamePos);
      expect(uploadStart).toBeGreaterThanOrEqual(0);

      const nextStep = workflow.indexOf("\n      - ", artifactNamePos);
      const uploadBlock = workflow.slice(uploadStart, nextStep === -1 ? workflow.length : nextStep);
      expect(uploadBlock).toContain("path: ./.hooshyar/" + filename);
      expect(uploadBlock).toContain("include-hidden-files: true");
    }
  });

  test("collector fails closed with a structured error when the qualification matrix is missing", () => {
    resetEvidenceDir();
    const result = runCollector();

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({
      type: "CLINE_RUNTIME_EVIDENCE",
      status: "BLOCKED",
      error: "QUALIFICATION_MATRIX_UNREADABLE",
    });
  });

  test("collector rejects an invalid qualification matrix", () => {
    resetEvidenceDir();
    const matrixPath = path.join(tempDir, "Docs", "Product", "PRODUCT_QUALIFICATION_MATRIX.json");
    fs.mkdirSync(path.dirname(matrixPath), { recursive: true });
    fs.writeFileSync(matrixPath, JSON.stringify({ required: [] }), "utf8");

    const result = runCollector();

    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({
      type: "CLINE_RUNTIME_EVIDENCE",
      status: "BLOCKED",
      error: "QUALIFICATION_MATRIX_INVALID",
    });
  });

  test("collector reports incomplete evidence without claiming qualification or masking blockers", () => {
    resetEvidenceDir();
    writeCanonicalMatrix();

    const result = runCollector();
    const evidence = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(evidence.verdict).toBe("REQUIRES_ADDITIONAL_EVIDENCE");
    expect(evidence.blockers.length).toBeGreaterThan(0);
    expect(evidence.cells).toHaveLength(10);
    expect(evidence.cells.every((item) => item.status === "BLOCKED")).toBe(true);
    expect(cell(evidence, "win-core").status).toBe("BLOCKED");
    expect(cell(evidence, "full-suite").status).toBe("BLOCKED");
  });

  test("collector rejects stale evidence bound to a different commit", () => {
    resetEvidenceDir();
    writeCanonicalMatrix();
    writeEvidence("factory-success.json", {
      type: "FINAL_PRODUCT_FACTORY_SUCCESS",
      version: 1,
      status: "PASS",
      commit: "0000000000000000000000000000000000000000",
      acceptance: ["runtime-health", "session", "tenant", "ingestion", "analysis", "dashboard"],
      fullJest: "PASS",
    });

    const result = runCollector();
    const evidence = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(evidence.verdict).toBe("REQUIRES_ADDITIONAL_EVIDENCE");
    expect(cell(evidence, "win-core").status).toBe("BLOCKED");
    expect(cell(evidence, "win-business").status).toBe("BLOCKED");
    expect(cell(evidence, "win-recovery").status).toBe("BLOCKED");
    expect(cell(evidence, "full-suite").status).toBe("BLOCKED");
  });

  test("collector completes only when every required evidence record is current and run-bound", () => {
    resetEvidenceDir();
    writeCanonicalMatrix();

    writeEvidence("factory-success.json", {
      type: "FINAL_PRODUCT_FACTORY_SUCCESS",
      version: 1,
      status: "PASS",
      commit: sha,
      acceptance: [
        "runtime-health", "session", "tenant", "ingestion", "analysis", "dashboard",
        "restart", "tenant-recovery", "dashboard-recovery", "full-jest",
      ],
      fullJest: "PASS",
    });
    writeEvidence("web-acceptance-success.json", {
      type: "WEB_PRODUCT_ACCEPTANCE_SUCCESS",
      version: 8,
      status: "PASS",
      commit: sha,
      acceptance: ["root", "health", "session", "tenant", "ingestion", "analysis", "dashboard"],
    });
    writeEvidence("security-acceptance-success.json", {
      type: "SECURITY_TENANT_ACCEPTANCE_SUCCESS",
      version: 4,
      status: "PASS",
      commit: sha,
      acceptance: [
        "unauthenticated-dashboard-denied",
        "unauthenticated-analyze-denied",
        "distinct-tenant-identities",
        "tenant-a-data-isolated",
        "tenant-b-data-isolated",
        "analytics-cross-tenant-read-denied",
        "report-artifact-cross-tenant-denied",
      ],
    });
    writeEvidence("android-acceptance-success.json", {
      type: "ANDROID_PRODUCT_ACCEPTANCE_SUCCESS",
      version: 1,
      status: "PASS",
      commit: sha,
      acceptance: [
        "apk-present", "device-online", "android-booted", "package-manager-ready",
        "apk-installed", "launcher-start", "process-alive", "main-activity-visible",
      ],
    });
    writeEvidence("full-suite-success.json", {
      type: "HOOSHYAR_FULL_SUITE_EVIDENCE_V1",
      status: "PASS",
      commit: sha,
      runId: TEST_RUN_ID,
      acceptance: ["full-jest", "typescript", "security-tenant-acceptance"],
    });
    writeEvidence("agent-repair-success.json", {
      type: "ASSISTANT_REPAIR_MISSION_V1_RESULT",
      status: "PASS",
      commit: sha,
      missionId: "test-mission",
      finding: { failedJobs: ["web-product-acceptance"] },
      repair: {
        changedFiles: 1,
        repairedJobs: [{ name: "web-product-acceptance", conclusion: "success", runId: TEST_RUN_ID }],
      },
      regression: { status: "PASS", fullJest: "PASS", pythonSyntax: "PASS" },
      factoryAcceptance: {
        status: "PASS",
        commit: sha,
        productFactoryJob: "windows-product-factory",
        productFactoryConclusion: "success",
        runId: TEST_RUN_ID,
      },
    });

    const result = runCollector();
    const evidence = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(evidence.verdict).toBe("QUALIFICATION_COMPLETE");
    expect(evidence.blockers).toEqual([]);
    expect(evidence.cells).toHaveLength(10);
    expect(evidence.cells.every((item) => item.status === "PASS")).toBe(true);
    expect(cell(evidence, "ci-feedback").status).toBe("PASS");
    expect(cell(evidence, "full-suite").status).toBe("PASS");
  });

  test("collector path contract matches android evidence script's canonical evidence path", () => {
    const workflow = fs.readFileSync(WORKFLOW_PATH, "utf8");
    const evidenceScript = fs.readFileSync(EVIDENCE_SCRIPT_PATH, "utf8");

    expect(evidenceScript).toContain("DEFAULT_EVIDENCE_PATH = path.join(ROOT, '.hooshyar', 'android-acceptance-success.json')");
    expect(workflow).toContain("name: hooshyar-android-product-acceptance-evidence");
  });
});
