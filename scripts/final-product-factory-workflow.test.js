const fs = require('node:fs');
const path = require('node:path');

describe('Final Product Factory evidence artifact contract', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '..', '.github', 'workflows', 'final-product-factory.yml'),
    'utf8'
  );

  test('uploads the same canonical evidence file that the factory step validates', () => {
    const validationStart = workflow.indexOf('name: Validate factory evidence exists');
    const uploadStart = workflow.indexOf('name: Upload product factory evidence');
    const releaseGateStart = workflow.indexOf('name: Fail release gate on factory failure');

    expect(validationStart).toBeGreaterThanOrEqual(0);
    expect(uploadStart).toBeGreaterThan(validationStart);
    expect(releaseGateStart).toBeGreaterThan(uploadStart);

    const stagingStart = workflow.indexOf('name: Stage canonical factory evidence for artifact upload');
    const uploadBlock = workflow.slice(uploadStart, releaseGateStart);

    expect(stagingStart).toBeGreaterThan(validationStart);
    expect(stagingStart).toBeLessThan(uploadStart);
    expect(workflow.slice(validationStart, stagingStart)).toContain('Test-Path .hooshyar/factory-success.json');
    expect(workflow.slice(stagingStart, uploadStart)).toContain('Copy-Item .hooshyar/factory-success.json ./factory-success.json -Force');
    expect(uploadBlock).toContain('path: ./factory-success.json');
    expect(uploadBlock).not.toContain('path: .hooshyar/factory-success.json');
  });
});
