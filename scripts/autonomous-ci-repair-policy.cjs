'use strict';
const EVIDENCE_ONLY_FAILURES = new Set(['runtime-evidence-qualification', 'release-gate']);
function shouldLaunchRepair(failedJobNames) {
  if (!Array.isArray(failedJobNames) || failedJobNames.length === 0) return true;
  return failedJobNames.some(name => typeof name !== 'string' || !EVIDENCE_ONLY_FAILURES.has(name));
}
module.exports = { shouldLaunchRepair };
