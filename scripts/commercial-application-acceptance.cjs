const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const evidenceDir = path.join(root, '.hooshyar');
const evidencePath = path.join(evidenceDir, 'commercial-application-acceptance.json');
const git = process.platform === 'win32' ? 'git.exe' : 'git';

function commit() {
  return cp.execFileSync(git, ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

function runScript(name) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', name], {
    cwd: root,
    stdio: 'inherit',
    encoding: 'utf8',
    shell: false,
    env: process.env
  });
  return result.status ?? 1;
}

fs.mkdirSync(evidenceDir, { recursive: true });
fs.rmSync(evidencePath, { force: true });
const repositoryCommit = commit();
const checks = [
  ['product:web:acceptance', 'web-application'],
  ['product:security:acceptance', 'security-application']
];
const completed = [];

for (const [script, capability] of checks) {
  const exitCode = runScript(script);
  if (exitCode !== 0) {
    const failure = {
      type: 'COMMERCIAL_APPLICATION_ACCEPTANCE_FAILURE',
      version: 1,
      status: 'BLOCKED',
      repositoryCommit,
      failedCapability: capability,
      script,
      exitCode,
      completed
    };
    fs.writeFileSync(evidencePath, JSON.stringify(failure, null, 2), 'utf8');
    console.error(JSON.stringify(failure, null, 2));
    process.exit(1);
  }
  completed.push(capability);
}

const success = {
  type: 'COMMERCIAL_APPLICATION_ACCEPTANCE',
  version: 1,
  status: 'PASS',
  repositoryCommit,
  checks: completed,
  generatedAt: new Date().toISOString()
};
fs.writeFileSync(evidencePath, JSON.stringify(success, null, 2), 'utf8');
console.log(JSON.stringify(success, null, 2));
