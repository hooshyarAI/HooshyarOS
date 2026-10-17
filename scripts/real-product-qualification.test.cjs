const fs = require('node:fs');
const path = require('node:path');
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

  test('PASS requires every required cell to have current commit, target and evidence reference', () => {
    const result = decideQualification(matrix, passingEvidence(), currentCommit);
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

  test('duplicate evidence cell IDs are rejected rather than silently overwritten', () => {
    const evidence = passingEvidence();
    evidence.cells.push({ ...evidence.cells[0], status: 'PASS' });
    const result = decideQualification(matrix, evidence, currentCommit);
    expect(result.status).toBe('BLOCKED');
    expect(result.reason).toBe('QUALIFICATION_EVIDENCE_CELL_IDS_INVALID_OR_DUPLICATED');
  });
});
