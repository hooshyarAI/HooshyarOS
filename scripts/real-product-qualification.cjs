const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const root = process.cwd();
const steps = [
  ['web-acceptance', ['run', 'product:web:acceptance']],
  ['security-tenant-acceptance', ['run', 'product:security:acceptance']],
  ['factory', ['run', 'product:factory']],
  ['cline-evidence', ['run', 'product:cline:evidence']]
];
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

function validateEvidenceReference(reference, currentCommit) {
  if (typeof reference !== 'string' || !reference.trim() || path.isAbsolute(reference) || reference.includes('://')) return false;
  const resolved = path.resolve(root, reference);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(resolved)) return false;
  try {
    const record = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    return record && record.commit === currentCommit && ['PASS', 'ACCEPTED'].includes(record.status);
  } catch {
    return false;
  }
}

function decideQualification(matrix, evidence, currentCommit, evidenceRefIsValid = () => false) {
  if (!matrix || !Array.isArray(matrix.required) || matrix.required.length === 0) {
    return { status: 'BLOCKED', reason: 'QUALIFICATION_MATRIX_MISSING_OR_INVALID', blockers: [] };
  }
  if (!evidence || typeof evidence !== 'object' || evidence.type !== 'HOOSHYAR_PRODUCT_QUALIFICATION_EVIDENCE_V1' ||
      evidence.commitSha !== currentCommit || !Array.isArray(evidence.cells)) {
    return {
      status: 'BLOCKED',
      reason: 'CURRENT_COMMIT_QUALIFICATION_EVIDENCE_MISSING_OR_STALE',
      blockers: matrix.required.map(cell => ({ id: cell.id, status: 'UNKNOWN' }))
    };
  }

  const ids = evidence.cells.map(cell => cell && cell.id);
  if (ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
    return { status: 'BLOCKED', reason: 'QUALIFICATION_EVIDENCE_CELL_IDS_INVALID_OR_DUPLICATED', blockers: matrix.required.map(cell => ({ id: cell.id, status: 'UNKNOWN' })) };
  }
  const byId = new Map(evidence.cells.map(cell => [cell.id, cell]));
  const blockers = [];
  for (const required of matrix.required) {
    const cell = byId.get(required.id);
    const valid = cell && cell.status === 'PASS' &&
      cell.commitSha === currentCommit &&
      cell.capability === required.capability &&
      cell.environment === required.environment &&
      cell.workflow === required.workflow &&
      cell.evidenceKind === required.evidence &&
      typeof cell.target === 'string' && cell.target.trim().length > 0 &&
      typeof cell.evidenceRef === 'string' && cell.evidenceRef.trim().length > 0 &&
      evidenceRefIsValid(cell.evidenceRef, currentCommit, required, cell);
    if (!valid) blockers.push({
      id: required.id,
      status: cell && typeof cell.status === 'string' ? cell.status : 'UNKNOWN'
    });
  }
  return blockers.length === 0
    ? { status: 'PASS', reason: 'ALL_REQUIRED_CELLS_HAVE_CURRENT_COMMIT_EVIDENCE', blockers: [] }
    : { status: 'BLOCKED', reason: 'REQUIRED_QUALIFICATION_CELLS_NOT_PROVEN', blockers };
}

function readJsonIfPresent(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
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

  const matrixPath = path.join(root, 'Docs', 'Product', 'PRODUCT_QUALIFICATION_MATRIX.json');
  const evidencePath = process.env.HOOSHYAR_PRODUCT_QUALIFICATION_EVIDENCE ||
    path.join(root, '.hooshyar', 'cline-runtime-evidence.json');
  const matrix = readJsonIfPresent(matrixPath);
  const evidence = readJsonIfPresent(evidencePath);
  const commitResult = spawnSync(process.platform === 'win32' ? 'git.exe' : 'git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const currentCommit = commitResult.status === 0 ? commitResult.stdout.trim() : null;
  const decision = currentCommit
    ? decideQualification(matrix, evidence, currentCommit, validateEvidenceReference)
    : { status: 'BLOCKED', reason: 'CURRENT_COMMIT_UNAVAILABLE', blockers: [] };

  console.log(JSON.stringify({
    type: 'REAL_PRODUCT_QUALIFICATION',
    stage: 'PRODUCT_QUALIFICATION_MATRIX',
    status: decision.status,
    commitSha: currentCommit,
    evidencePath,
    reason: decision.reason,
    blockers: decision.blockers
  }, null, 2));

  if (decision.status !== 'PASS') {
    console.error(JSON.stringify({
      type: 'REAL_PRODUCT_QUALIFICATION',
      stage: 'COMPLETE',
      status: 'BLOCKED',
      details: 'Acceptance commands passed, but one or more required cells lack verifiable, current-commit evidence.'
    }));
    return 2;
  }

  console.log(JSON.stringify({
    type: 'REAL_PRODUCT_QUALIFICATION',
    stage: 'COMPLETE',
    status: 'PASS',
    commitSha: currentCommit,
    details: 'All required qualification matrix cells have verifiable evidence bound to the current commit.'
  }));
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { launchNpm, run, steps, main, decideQualification, validateEvidenceReference };
