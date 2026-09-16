const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const evidenceDir = path.join(root, '.hooshyar');
const evidencePath = path.join(evidenceDir, 'commercial-application-acceptance.json');
const git = process.platform === 'win32' ? 'git.exe' : 'git';
// On Windows the npm CLI is `npm.cmd`, and Node refuses to spawn a `.cmd`/`.bat`
// file with `shell: false` (it reports EINVAL before the process starts). That
// made this harness record BLOCKED / exit 1 at the first capability without ever
// running it. Launch through the platform command processor instead, matching the
// other acceptance harnesses under scripts/.
const shell = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : null;

const checks = [
  ['product:web:acceptance', 'web-application'],
  ['product:pdf:acceptance', 'pdf-acquisition'],
  ['product:security:acceptance', 'security-application']
];
const SCRIPT_NAMES = checks.map(([script]) => script);

function commit() {
  return cp.execFileSync(git, ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
}

/**
 * Launch the npm CLI. `stdio` defaults to `inherit` so acceptance output stays
 * visible to the operator. A real child exit code is returned as-is; a launcher
 * failure (spawn error / signal) is surfaced instead of being silently folded
 * into exit code 1.
 */
function launchNpm(args, stdio = 'inherit') {
  if (!Array.isArray(args) || args.length === 0) throw new Error('COMMERCIAL_ACCEPTANCE_EMPTY_NPM_ARGS');
  const result = shell
    ? spawnSync(shell, ['/d', '/s', '/c', `npm ${args.join(' ')}`], { cwd: root, stdio, encoding: 'utf8', shell: false, env: process.env })
    : spawnSync('npm', args, { cwd: root, stdio, encoding: 'utf8', shell: false, env: process.env });
  return {
    exitCode: result.status ?? 1,
    signal: result.signal ?? null,
    error: result.error ? `${result.error.code || 'ERROR'}: ${result.error.message}` : null
  };
}

/** Run one of the canonical capability acceptance scripts. */
function runScript(name, stdio = 'inherit') {
  if (!SCRIPT_NAMES.includes(name)) throw new Error(`COMMERCIAL_ACCEPTANCE_UNKNOWN_SCRIPT:${name}`);
  return launchNpm(['run', name], stdio);
}

function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.rmSync(evidencePath, { force: true });
  const repositoryCommit = commit();
  const completed = [];

  for (const [script, capability] of checks) {
    const outcome = runScript(script);
    if (outcome.exitCode !== 0) {
      const failure = {
        type: 'COMMERCIAL_APPLICATION_ACCEPTANCE_FAILURE',
        version: 1,
        status: 'BLOCKED',
        repositoryCommit,
        failedCapability: capability,
        script,
        exitCode: outcome.exitCode,
        completed
      };
      if (outcome.signal) failure.signal = outcome.signal;
      if (outcome.error) failure.launcherError = outcome.error;
      const serialized = JSON.stringify(failure, null, 2);
      fs.writeFileSync(evidencePath, serialized, 'utf8');
      console.error(serialized);
      return 1;
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
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { launchNpm, runScript, checks, SCRIPT_NAMES, evidencePath };
