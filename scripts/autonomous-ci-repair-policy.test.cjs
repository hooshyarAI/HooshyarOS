'use strict';
const { shouldLaunchRepair } = require('./autonomous-ci-repair-policy.cjs');
describe('autonomous CI repair launch policy', () => {
  test('does not start a second repair for evidence/release-gate-only failures', () => {
    expect(shouldLaunchRepair(['runtime-evidence-qualification', 'release-gate'])).toBe(false);
  });
  test('starts repair when a product acceptance job failed too', () => {
    expect(shouldLaunchRepair(['runtime-evidence-qualification', 'release-gate', 'web-product-acceptance'])).toBe(true);
  });
  test('starts repair when a product factory job failed', () => {
    expect(shouldLaunchRepair(['windows-product-factory'])).toBe(true);
  });
  test('fails safe when failed-job evidence is missing or malformed', () => {
    expect(shouldLaunchRepair([])).toBe(true);
    expect(shouldLaunchRepair(null)).toBe(true);
    expect(shouldLaunchRepair(['release-gate', null])).toBe(true);
  });
});
