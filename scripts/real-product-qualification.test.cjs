const { decideQualification } = require('./real-product-qualification.cjs');

const currentCommit = 'a'.repeat(40);
const matrix = {
  required: [
    { id: 'win-core' },
    { id: 'win-business' },
    { id: 'web-core' }
  ]
};

function passingEvidence() {
  return {
    commitSha: currentCommit,
    cells: matrix.required.map(cell => ({
      id: cell.id,
      status: 'PASS',
      commitSha: currentCommit,
      target: 'CI acceptance runner',
      evidenceRef: `artifact://${cell.id}`
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

  test('missing target or evidence reference cannot qualify a cell', () => {
    const evidence = passingEvidence();
    delete evidence.cells[1].evidenceRef;
    const result = decideQualification(matrix, evidence, currentCommit);
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toContainEqual({ id: 'win-business', status: 'PASS' });
  });
});
