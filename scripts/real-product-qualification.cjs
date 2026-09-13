const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = process.cwd();
const steps = [
  ['web-acceptance', ['run', 'product:web:acceptance']],
  ['security-tenant-acceptance', ['run', 'product:security:acceptance']],
  ['factory', ['run', 'product:factory']],
  ['cline-evidence', ['run', 'product:cline:evidence']]
];

function run(label, args) {
  console.log(JSON.stringify({ type: 'REAL_PRODUCT_QUALIFICATION', stage: label, status: 'RUNNING' }));
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.status !== 0) {
    console.error(JSON.stringify({ type: 'REAL_PRODUCT_QUALIFICATION', stage: label, status: 'BLOCKED', exitCode: result.status }));
    process.exit(result.status || 1);
  }
  console.log(JSON.stringify({ type: 'REAL_PRODUCT_QUALIFICATION', stage: label, status: 'PASS' }));
}

console.log(JSON.stringify({
  type: 'REAL_PRODUCT_QUALIFICATION_START',
  repository: root,
  law: path.join(root, 'Docs', 'REAL_PRODUCT_OPERATION_LAW.md')
}));

for (const [label, args] of steps) run(label, args);

console.log(JSON.stringify({
  type: 'REAL_PRODUCT_QUALIFICATION',
  stage: 'COMPLETE',
  status: 'PASS',
  details: 'web + security/tenant + runtime/recovery + full Jest + commercial evidence gates passed'
}));
