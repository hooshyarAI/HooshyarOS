const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const failurePath = path.resolve(root, '.hooshyar', 'factory-failure.json');
const successPath = path.resolve(root, '.hooshyar', 'factory-success.json');

if (!fs.existsSync(failurePath)) {
  console.log(JSON.stringify({
    type: 'PRODUCT_FACTORY_HANDOFF',
    status: 'NO_FAILURE',
    message: fs.existsSync(successPath)
      ? 'Last factory run completed successfully.'
      : 'No factory evidence is available yet.'
  }, null, 2));
  process.exit(fs.existsSync(successPath) ? 0 : 2);
}

const evidence = JSON.parse(fs.readFileSync(failurePath, 'utf8'));
const mission = {
  type: 'ASSISTANT_REPAIR_MISSION',
  version: 1,
  source: 'final-product-factory',
  status: 'BLOCKED',
  createdAt: evidence.createdAt,
  failure: evidence.failure,
  stage: evidence.stage,
  repository: evidence.repository,
  branch: evidence.branch,
  commit: evidence.commit,
  rules: {
    preserveArchitecture: true,
    preserveTests: true,
    noTestWeakening: true,
    smallestCoherentRepair: true,
    requiredRegressionTest: true,
    rerunFactoryAfterRepair: true,
    rerunFullJestAfterAcceptance: true
  },
  nextActions: [
    'Read the failure evidence and identify the first failing stage.',
    'Inspect the concrete runtime/code path responsible for the failure.',
    'Apply the smallest coherent repair without weakening tests or architecture.',
    'Add or update a regression test for the defect.',
    'Run the focused verification.',
    'Run npm run product:factory.',
    'After factory acceptance passes, run npm test -- --runInBand.'
  ],
  evidence
};

console.log(JSON.stringify(mission, null, 2));
process.exit(1);
