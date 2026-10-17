const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { decideQualification, validateEvidenceReference } = require('./real-product-qualification.cjs');

const currentCommit = 'a'.repeat(40);
const matrix = {
  required: [
    { id: 'win-core', capability: 'commercial-runtime', environment: 'windows', workflow: 'launch-health-ready', evidence: 'runtime' },
    { id: 'win-business', capability: 'financial-platform', environment: 'windows', workflow: 'login-tenant-ingest-analyze-dashboard', evidence: 'application' },
    { id: 'web-core', capability: 'commercial-runtime', environment: 'web', workflow: 'launch-health-ready-ui', evidence: 'runtime' }
  ]
};

function passingEvidence() {
  return {
    type: 'HOOSHYAR_PRODUCT_QUALIFICATION_EVIDENCE_V1',
    commitSha: currentCommit,
    cells: matrix.required.map(cell => ({
      id: cell.id,
      status: 'PASS',
      commitSha: currentCommit,
      capability: cell.capability,
      environment: cell.environment,
      workflow: cell.workflow,
      evidenceKind: cell.evidence,
      target: cell.environment === 'windows' ? 'Windows runner' : 'Web CI runner',
      evidenceRef: `.hooshyar/${cell.id}.json`
    }))
  };
}

describe('real product qualification fail-closed contract', () => {
  test('missing evidence blocks completion and marks required cells UNKNOWN', () => {
    const result = decideQualification(matrix, null, currentCommit);
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toBe('CURRENT_COMMIT_QUALIFICATION_EVIDENCE_MISSING_OR_STALE');
    expect(result.blockers).toEqual([
      { id: 'win-core', status: 'UNKNOWN' },
      { id: 'win-business', status: 'UNKNOWN' },
      { id: 'web-core', status: 'UNKNOWN' }
    ]);
  });

  test('evidence from an earlier commit cannot qualify the current commit', () => {
    const evidence = passingEvidence();
    evidence.commitSha = 'b'.repeat(40);
    const result = decideQualification(matrix, evidence, currentCommit);
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toBe('CURRENT_COMMIT_QUALIFICATION_EVIDENCE_MISSING_OR_STALE');
  });

  test('wrong evidence schema blocks completion', () => {
    const evidence = passingEvidence();
    evidence.type = 'UNTRUSTED_OR_UNKNOWN_SCHEMA';
    expect(decideQualification(matrix, evidence, currentCommit).status).toBe('BLOCKED');
  });

  test('any required cell without current PASS evidence blocks completion', () => {
    const evidence = passingEvidence();
    evidence.cells[0].status = 'BLOCKED';
    const result = decideQualification(matrix, evidence, currentCommit);
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContainEqual({ id: 'win-core', status: 'BLOCKED' });
  });

  test('omitting the evidence reference validator cannot qualify any cell', () => {
    const result = decideQualification(matrix, passingEvidence(), currentCommit);
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toBe('REQUIRED_QUALIFICATION_CELLS_NOT_PROVEN');
    expect(result.blockers.map(cell => cell.id)).toEqual(matrix.required.map(cell => cell.id));
  });

  test('PASS requires every required cell to have current commit, target and evidence reference when validator explicitly confirms them', () => {
    const result = decideQualification(matrix, passingEvidence(), currentCommit, () => true);
    expect(result).toEqual({
      status: 'PASS',
      reason: 'ALL_REQUIRED_CELLS_HAVE_CURRENT_COMMIT_EVIDENCE',
      blockers: []
    });
  });

  test('evidence for a different matrix workflow cannot satisfy a required cell', () => {
    const evidence = passingEvidence();
    evidence.cells[0].workflow = 'unrelated-check';
    const result = decideQualification(matrix, evidence, currentCommit);
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContainEqual({ id: 'win-core', status: 'PASS' });
  });

  test('missing target or evidence reference cannot qualify a cell', () => {
    const evidence = passingEvidence();
    delete evidence.cells[1].evidenceRef;
    const result = decideQualification(matrix, evidence, currentCommit);
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContainEqual({ id: 'win-business', status: 'PASS' });
  });

  test('a non-resolving evidence reference cannot qualify a cell', () => {
    const result = decideQualification(matrix, passingEvidence(), currentCommit, () => false);
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toHaveLength(matrix.required.length);
  });


  test('source references must resolve to a current-commit PASS or ACCEPTED record', () => {
    const dir = path.join(process.cwd(), '.hooshyar');
    fs.mkdirSync(dir, { recursive: true });
    const source = path.join(dir, 'qualification-reference-test.json');
    const reference = path.relative(process.cwd(), source);
    try {
      fs.writeFileSync(source, JSON.stringify({ commit: currentCommit, status: 'PASS' }));
      expect(validateEvidenceReference(reference, currentCommit)).toBe(true);
      expect(validateEvidenceReference(reference, 'b'.repeat(40))).toBe(false);
      fs.writeFileSync(source, JSON.stringify({ commit: currentCommit, status: 'BLOCKED' }));
      expect(validateEvidenceReference(reference, currentCommit)).toBe(false);
      expect(validateEvidenceReference('https://example.invalid/evidence.json', currentCommit)).toBe(false);
    } finally {
      fs.rmSync(source, { force: true });
    }
  });

  test('a symlink inside the repository cannot validate evidence outside it', () => {
    const repoRoot = fs.realpathSync(process.cwd());
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooshyar-evidence-outside-'));
    const outsideRoot = fs.realpathSync(outsideDir);
    const outsideRelative = path.relative(repoRoot, outsideRoot);
    const outsideIsWithinRepo = !outsideRelative ||
      (!outsideRelative.startsWith('..') && !path.isAbsolute(outsideRelative));
    if (outsideIsWithinRepo) {
      fs.rmSync(outsideDir, { recursive: true, force: true });
      throw new Error('Could not create an outside-repository fixture for symlink containment test');
    }

    const insideDir = path.join(process.cwd(), '.hooshyar');
    fs.mkdirSync(insideDir, { recursive: true });
    const linkPath = path.join(insideDir, 'qualification-reference-escape');
    fs.writeFileSync(
      path.join(outsideDir, 'outside-evidence.json'),
      JSON.stringify({ commit: currentCommit, status: 'PASS' })
    );
    let linkCreated = false;
    try {
      fs.symlinkSync(outsideDir, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
      linkCreated = true;
      const reference = path.relative(
        process.cwd(),
        path.join(linkPath, 'outside-evidence.json')
      );
      expect(validateEvidenceReference(reference, currentCommit)).toBe(false);
    } finally {
      if (linkCreated) fs.rmSync(linkPath, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  test('duplicate evidence cell IDs are rejected rather than silently overwritten', () => {
    const evidence = passingEvidence();
    evidence.cells.push({ ...evidence.cells[0], status: 'PASS' });
    const result = decideQualification(matrix, evidence, currentCommit);
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toBe('QUALIFICATION_EVIDENCE_CELL_IDS_INVALID_OR_DUPLICATED');
  });
});
