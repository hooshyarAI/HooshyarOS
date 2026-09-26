const { spawnSync, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const gates = {
  runtime: [
    'Backend/HBOS/test/FinalProductRuntimeQualification.test.ts',
    'Backend/HBOS/test/CommercialRuntimeBusinessFlow.test.ts',
  ],
  architecture: [
    'Backend/HBOS/test/HBOSBootIntegration.test.ts',
    'Backend/HBOS/test/EngineRegistry.phase-11-1.2.test.ts',
    'Backend/HBOS/test/EngineDependencyManager.test.ts',
    'Backend/HBOS/test/BootDependencyValidator.test.ts',
  ],
  persistence_recovery: [
    'Backend/HBOS/Product/FinancialStatementAnalysisService.test.ts',
    'Backend/HBOS/test/TenantIsolationVerification.test.ts',
    'Backend/HBOS/test/ProductionReadinessEngine.test.ts',
    'Backend/HBOS/test/SystemReadiness.test.ts',
  ],
  security: [
    'Backend/HBOS/test/SecurityAuditEngine.test.ts',
    'Backend/HBOS/test/SecurityLayerEngine.test.ts',
    'Backend/HBOS/test/ProductionSecurityEvidence.test.ts',
  ],
  dashboard_and_value: [
    'Backend/HBOS/test/DashboardEngine.test.ts',
    'Backend/HBOS/test/FinancialIntelligenceEngine.test.ts',
    'Backend/HBOS/test/BudgetIntelligenceEngine.test.ts',
    'Backend/HBOS/test/RiskIntelligenceEngine.test.ts',
    'Backend/HBOS/test/DecisionIntelligenceEngine.test.ts',
    'Backend/HBOS/test/ReportsEngine.test.ts',
    'Backend/HBOS/test/AlertsEngine.test.ts',
  ],
  reasoning_ai: [
    'Backend/HBOS/test/ReasoningEngine.test.ts',
    'Backend/HBOS/test/PythonReasoningAdapter.test.ts',
    'Backend/HBOS/AI/test/AIRuntime.test.ts',
  ],
  installer_and_deployment: [
    'Backend/HBOS/test/WindowsProductInstallerContract.test.ts',
    'Backend/HBOS/test/DeploymentContractEngine.test.ts',
    'Backend/HBOS/test/CloudDeploymentEngine.test.ts',
    'Backend/HBOS/test/DeploymentReadinessEngine.test.ts',
  ],
};

const allTests = [...new Set(Object.values(gates).flat())];
const missing = allTests.filter((file) => !fs.existsSync(file));

/** Authoritative local commit, used to bind external evidence to the code it proves. */
function headCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * The real-browser acceptance is a host-executable external cell. It is
 * reported PASS only when the canonical harness has written a PASS artifact
 * bound to the current revision of that harness; a stale or missing artifact is
 * never reported as executed.
 */
function harnessRevision() {
  try {
    const sha = execFileSync('git', ['log', '-1', '--format=%H', '--', 'scripts/web-browser-acceptance.cjs'], { cwd: process.cwd(), encoding: 'utf8' }).trim();
    return sha || null;
  } catch {
    return null;
  }
}

function browserAcceptanceStatus() {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.hooshyar', 'web-browser-acceptance.json'), 'utf8'));
    const expected = harnessRevision();
    if (parsed.status === 'PASS' && expected && parsed.commit === expected) return 'PASS';
    return 'STALE_EVIDENCE';
  } catch {
    return 'EXTERNAL_NOT_EXECUTED';
  }
}

const result = {
  version: 2,
  commit: process.env.GITHUB_SHA || headCommit() || 'local',
  timestamp: new Date().toISOString(),
  gates: {},
  external: {
    windowsRealDevice: 'EXTERNAL_NOT_EXECUTED',
    webRealBrowser: browserAcceptanceStatus(),
    androidRealDevice: 'EXTERNAL_NOT_EXECUTED',
    paymentActivation: 'EXTERNAL_NOT_EXECUTED',
    productionCloudActivation: 'EXTERNAL_NOT_EXECUTED',
  },
  overall: 'BLOCK_INTERNAL',
};

if (missing.length) {
  result.missingTests = missing;
} else {
  let allInternalPass = true;
  for (const [gate, tests] of Object.entries(gates)) {
    const run = spawnSync(
      process.execPath,
      ['./node_modules/jest/bin/jest.js', '--runInBand', ...tests],
      { stdio: 'inherit', shell: false }
    );
    const passed = run.status === 0;
    result.gates[gate] = {
      status: passed ? 'PASS' : 'BLOCK',
      tests,
      exitCode: run.status,
    };
    if (!passed) allInternalPass = false;
  }
  result.overall = allInternalPass ? 'BLOCK_EXTERNAL' : 'BLOCK_INTERNAL';
}

const outputDir = path.join(process.cwd(), 'AuditOutput');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
  path.join(outputDir, 'final-product-qualification.json'),
  JSON.stringify(result, null, 2) + '\n',
  'utf8'
);

console.log(JSON.stringify(result, null, 2));
process.exit(result.overall === 'BLOCK_INTERNAL' ? 1 : 0);
