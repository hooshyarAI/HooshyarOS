const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const gates = {
  runtime: [
    'Backend/HBOS/test/FinalProductRuntimeQualification.test.ts',
    'Backend/HBOS/test/CommercialRuntimeBusinessFlow.test.ts',
  ],
  architecture: [
    'Backend/HBOS/test/HBOSBootIntegration.test.ts',
    'Backend/HBOS/test/EngineRegistry.test.ts',
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

const result = {
  version: 2,
  commit: process.env.GITHUB_SHA || 'local',
  timestamp: new Date().toISOString(),
  gates: {},
  external: {
    windowsRealDevice: 'EXTERNAL_NOT_EXECUTED',
    webRealBrowser: 'EXTERNAL_NOT_EXECUTED',
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
