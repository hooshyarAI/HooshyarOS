const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = process.cwd();
const steps = [
  ['web-acceptance', ['run', 'product:web:acceptance']],
  ['security-tenant-acceptance', ['run', 'product:security:acceptance']],
  ['factory', ['run', 'product:factory']],
  ['cline-evidence', ['run', 'product:cline:evidence']]
];
// Node refuses to spawn a `.cmd`/`.bat` file with `shell: false` on Windows (it
// reports EINVAL before the child starts), so the npm CLI is launched through the
// platform command processor there — the convention used by the other
// qualification harnesses under scripts/.
const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : null;

function launchNpm(args, stdio = 'inherit') {
  if (!Array.isArray(args) || args.length === 0) throw new Error('REAL_PRODUCT_QUALIFICATION_EMPTY_NPM_ARGS');
  const result = shell
    ? spawnSync(shell, ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd: root, stdio, shell: false })
    : spawnSync('npm', args, { cwd: root, stdio, shell: false });
  return {
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error ? `${result.error.code || 'ERROR'}: ${result.error.message}` : null
  };
}

function run(label, args, stdio = 'inherit') {
  console.log(JSON.stringify({ type: 'REAL_PRODUCT_QUALIFICATION', stage: label, status: 'RUNNING' }));
  const outcome = launchNpm(args, stdio);
  if (outcome.exitCode !== 0) {
    console.error(JSON.stringify({
      type: 'REAL_PRODUCT_QUALIFICATION',
      stage: label,
      status: 'BLOCKED',
      exitCode: outcome.exitCode,
      signal: outcome.signal,
      launcherError: outcome.error
    }));
    return outcome.exitCode;
  }
  console.log(JSON.stringify({ type: 'REAL_PRODUCT_QUALIFICATION', stage: label, status: 'PASS' }));
  return 0;
}

function main() {
  console.log(JSON.stringify({
    type: 'REAL_PRODUCT_QUALIFICATION_START',
    repository: root,
    law: path.join(root, 'Docs', 'REAL_PRODUCT_OPERATION_LAW.md')
  }));

  for (const [label, args] of steps) {
    const exitCode = run(label, args);
    if (exitCode !== 0) return exitCode;
  }

  console.log(JSON.stringify({
    type: 'REAL_PRODUCT_QUALIFICATION',
    stage: 'COMPLETE',
    status: 'PASS',
    details: 'web + security/tenant + runtime/recovery + full Jest + commercial evidence gates passed'
  }));
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { launchNpm, run, steps, main };
