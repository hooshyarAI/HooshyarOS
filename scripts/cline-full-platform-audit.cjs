#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const manifestPath = path.join(root, 'Docs', 'Product', 'PRODUCT_PLATFORM_MANIFEST.json');
const matrixPath = path.join(root, 'Docs', 'Product', 'PRODUCT_QUALIFICATION_MATRIX.json');
const outputDir = path.join(root, '.hooshyar');
const outputPath = path.join(outputDir, 'cline-platform-audit.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function safeGit(args) {
  try { return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', args, { cwd: root, encoding: 'utf8' }).trim(); }
  catch { return ''; }
}
function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.venv'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(path.relative(root, full));
  }
  return acc;
}
function scripts() {
  try { return Object.keys(readJson(path.join(root, 'package.json')).scripts ?? {}); }
  catch { return []; }
}
function workflowFiles() {
  const dir = path.join(root, '.github', 'workflows');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(x => /\.(yml|yaml)$/i.test(x)).sort();
}
function classifyStaticCell(cell, context) {
  if (cell.id === 'full-suite' && context.testCommand) return 'REQUIRES_EXECUTION';
  if (cell.id === 'ci-feedback' && context.handoff && context.clineRules && context.factory) return 'REQUIRES_AGENT_EXECUTION';
  if (cell.environment === 'windows' && context.factory) return 'REQUIRES_EXECUTION';
  if (cell.environment === 'web' && context.webAcceptance) return 'REQUIRES_EXECUTION';
  if (cell.environment === 'android' && context.androidWorkflow) return 'REQUIRES_DEVICE_EXECUTION';
  if (cell.id === 'tenant-isolation') return context.tenantEvidence ? 'REQUIRES_EXECUTION' : 'UNKNOWN';
  return 'UNKNOWN';
}

const manifest = readJson(manifestPath);
const matrix = readJson(matrixPath);
const files = walk(root);
const pkgScripts = scripts();
const workflows = workflowFiles();
const context = {
  factory: pkgScripts.includes('product:factory'),
  webAcceptance: pkgScripts.includes('product:web:acceptance'),
  handoff: pkgScripts.includes('product:factory:handoff'),
  testCommand: pkgScripts.includes('test'),
  clineRules: exists('.clinerules'),
  androidWorkflow: workflows.some(x => /android/i.test(x)),
  tenantEvidence: files.some(x => /tenant.*(test|acceptance|qualification)/i.test(x))
};

const findings = [];
for (const required of [
  '.clinerules',
  'Docs/Product/PRODUCT_PLATFORM_MANIFEST.json',
  'Docs/Product/PRODUCT_QUALIFICATION_MATRIX.json',
  'Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md',
  'Docs/HOOSHYAROS_MASTER_CHARTER.md'
]) {
  if (!exists(required)) findings.push({ severity: 'CRITICAL', code: 'MISSING_SOURCE_OF_TRUTH', file: required });
}

if (workflows.length === 0) {
  findings.push({
    severity: 'CRITICAL',
    code: 'WORKFLOW_DISCOVERY_FAILURE',
    file: '.github/workflows',
    message: 'No GitHub Actions workflow files were discovered by the audit runner.'
  });
}

const cells = matrix.required.map(cell => ({
  ...cell,
  staticStatus: classifyStaticCell(cell, context),
  evidenceRequired: cell.evidence,
  evidence: null
}));

const audit = {
  type: 'CLINE_PLATFORM_AUDIT_V1',
  version: 1,
  createdAt: new Date().toISOString(),
  repository: root,
  git: {
    branch: safeGit(['branch', '--show-current']) || 'DETACHED',
    commit: safeGit(['rev-parse', 'HEAD']) || 'UNKNOWN',
    clean: safeGit(['status', '--porcelain', '--untracked-files=all']) === ''
  },
  scope: {
    manifestLayers: manifest.layers?.map(x => x.id) ?? [],
    environments: manifest.environments ?? [],
    filesScanned: files.length,
    workflowsScanned: workflows.length,
    workflowFiles: workflows,
    packageScripts: pkgScripts
  },
  findings,
  qualificationCells: cells,
  verdict: findings.some(x => x.severity === 'CRITICAL') ? 'BLOCKED' : 'REQUIRES_RUNTIME_AND_AGENT_EVIDENCE',
  completionRule: 'Cline audit evidence is not product completion; every required Matrix cell still requires its declared runtime/application/acceptance/CI evidence.'
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(audit, null, 2), 'utf8');
console.log(JSON.stringify(audit, null, 2));
process.exitCode = audit.verdict === 'BLOCKED' ? 1 : 0;
