'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');

const TYPE = 'ASSISTANT_REPAIR_MISSION_V1_RESULT';
const TRUSTED_REF = 'refs/heads/main';
const TARGET_BASE_BRANCH = 'fix/autonomous-product-factory';
const OPT_IN_VALUE = 'I_AUTHORIZE_ONE_CONTROLLED_REPAIR_DRILL';
const FAILED_EVIDENCE_JOBS = ['release-gate', 'runtime-evidence-qualification'];
const REQUIRED_ACCEPTANCE_JOBS = [
  'windows-product-factory',
  'web-product-acceptance',
  'security-tenant-acceptance',
  'android-product-acceptance',
  'full-qualification'
];
const DRILL_PATH = '.hooshyar/repair-drill/repair-target.cjs';

function sameStrings(left, right) {
  if (!Array.isArray(left) || left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

function validatePreflight(input) {
  if (!input || input.ref !== TRUSTED_REF) return { ok: false, reason: 'UNTRUSTED_DISPATCH_REF' };
  if (input.optIn !== OPT_IN_VALUE) return { ok: false, reason: 'EXPLICIT_OPT_IN_REQUIRED' };
  if (typeof input.repository !== 'string' || !/^[^/]+\/[^/]+$/.test(input.repository)) {
    return { ok: false, reason: 'REPOSITORY_IDENTITY_INVALID' };
  }
  if (!Number.isSafeInteger(Number(input.prNumber)) || Number(input.prNumber) < 1) {
    return { ok: false, reason: 'TARGET_PR_NUMBER_INVALID' };
  }
  if (!/^[0-9a-f]{40}$/i.test(input.targetHeadSha || '')) {
    return { ok: false, reason: 'TARGET_HEAD_SHA_INVALID' };
  }
  if (!Number.isSafeInteger(Number(input.failedFactoryRunId)) || Number(input.failedFactoryRunId) < 1) {
    return { ok: false, reason: 'FAILED_FACTORY_RUN_ID_INVALID' };
  }

  const pr = input.pullRequest;
  if (!pr || Number(pr.number) !== Number(input.prNumber) || pr.state !== 'open') {
    return { ok: false, reason: 'TARGET_PR_NOT_OPEN_OR_ID_MISMATCH' };
  }
  if (pr.base?.ref !== TARGET_BASE_BRANCH) return { ok: false, reason: 'TARGET_PR_BASE_NOT_ALLOWED' };
  if (pr.head?.repo?.full_name !== input.repository) return { ok: false, reason: 'CROSS_REPOSITORY_HEAD_BLOCKED' };
  if (!pr.head?.ref || ['main', 'master'].includes(pr.head.ref)) {
    return { ok: false, reason: 'PROTECTED_SOURCE_BRANCH_BLOCKED' };
  }
  if (pr.head?.sha !== input.targetHeadSha) return { ok: false, reason: 'TARGET_HEAD_SHA_MISMATCH' };

  const run = input.sourceRun;
  if (!run || Number(run.id) !== Number(input.failedFactoryRunId)) {
    return { ok: false, reason: 'SOURCE_RUN_ID_MISMATCH' };
  }
  if (run.name !== 'Final Product Factory' ||
      run.path !== '.github/workflows/final-product-factory.yml' ||
      run.event !== 'pull_request' ||
      run.status !== 'completed' ||
      run.conclusion !== 'failure') {
    return { ok: false, reason: 'SOURCE_RUN_NOT_EXPECTED_FAILED_FACTORY' };
  }
  if (run.head_sha !== input.targetHeadSha || run.head_branch !== pr.head.ref) {
    return { ok: false, reason: 'SOURCE_RUN_HEAD_MISMATCH' };
  }
  if (!Array.isArray(run.pull_requests) ||
      !run.pull_requests.some(item => Number(item.number) === Number(input.prNumber))) {
    return { ok: false, reason: 'SOURCE_RUN_NOT_ASSOCIATED_WITH_TARGET_PR' };
  }

  const jobs = input.jobs;
  if (!Array.isArray(jobs) || jobs.length === 0) return { ok: false, reason: 'SOURCE_RUN_JOBS_MISSING' };
  const failed = jobs.filter(job => job.conclusion === 'failure').map(job => job.name);
  if (!sameStrings(failed, FAILED_EVIDENCE_JOBS)) {
    return { ok: false, reason: 'SOURCE_RUN_FAILURE_SCOPE_NOT_EVIDENCE_ONLY' };
  }
  for (const requiredName of REQUIRED_ACCEPTANCE_JOBS) {
    if (!jobs.some(job => job.name === requiredName && job.conclusion === 'success')) {
      return { ok: false, reason: 'SOURCE_ACCEPTANCE_JOB_NOT_GREEN:' + requiredName };
    }
  }

  return {
    ok: true,
    reason: 'EXACT_PR_SHA_AND_EVIDENCE_ONLY_FAILURE_VERIFIED',
    targetBranch: pr.head.ref,
    targetHeadSha: pr.head.sha,
    failedFactoryRunId: Number(run.id),
    failedFactoryRunUrl: run.html_url,
    failedJobs: [...failed].sort()
  };
}

function injectControlledDefect(sourceContent) {
  if (typeof sourceContent !== 'string') throw new Error('DRILL_SOURCE_NOT_TEXT');
  const expected = 'return revenue + expense;';
  const occurrences = sourceContent.split(expected).length - 1;
  if (occurrences !== 1) throw new Error('DRILL_SOURCE_CONTRACT_CHANGED');
  return sourceContent.replace(expected, 'return revenue - expense;');
}

function validateControlledDrillEvidence(evidence, currentCommit, expectedDrillRunId) {
  const reject = reason => ({ valid: false, reason });
  if (!evidence || evidence.type !== TYPE) return reject('EVIDENCE_TYPE_INVALID');
  if (evidence.status !== 'PASS' || evidence.mode !== 'controlled-drill') return reject('CONTROLLED_DRILL_STATUS_INVALID');
  if (!/^[0-9a-f]{40}$/i.test(currentCommit || '') || evidence.commit !== currentCommit) {
    return reject('EVIDENCE_COMMIT_MISMATCH');
  }
  if (!evidence.missionId || !/^[0-9a-f]{64}$/i.test(evidence.missionId)) return reject('MISSION_ID_INVALID');

  const finding = evidence.finding;
  if (!Number.isSafeInteger(finding?.sourceRunId) || finding.sourceRunId < 1 ||
      !Number.isSafeInteger(finding?.preflightRunId) || finding.preflightRunId < 1 ||
      finding.preflightRunId === finding.sourceRunId ||
      !sameStrings(finding?.failedJobs, FAILED_EVIDENCE_JOBS) ||
      finding.sourceCommit !== currentCommit ||
      typeof finding.sourceRunUrl !== 'string' || !finding.sourceRunUrl.startsWith('https://github.com/')) {
    return reject('TRIGGER_RUN_PROVENANCE_INVALID');
  }

  const drill = evidence.drill;
  const expectedRunId = Number(expectedDrillRunId);
  if (!Number.isSafeInteger(expectedRunId) || expectedRunId < 1 || drill?.runId !== expectedRunId) {
    return reject('DRILL_RUN_ID_MISMATCH');
  }
  if (!Number.isSafeInteger(drill?.runId) || drill.runId < 1 ||
      drill.runId === finding.sourceRunId ||
      drill.runId === finding.preflightRunId ||
      drill.injectedExitCode !== 1 ||
      drill.injectedResult !== 1800 ||
      drill.repairedExitCode !== 0 ||
      drill.repairedResult !== 1200 ||
      drill.expectedResult !== 1200 ||
      drill.injectedFailureObserved !== true ||
      drill.repairObserved !== true) {
    return reject('CONTROLLED_FAILURE_REPAIR_NOT_PROVEN');
  }

  const repair = evidence.repair;
  if (repair?.previousCommit !== currentCommit ||
      repair?.commit !== currentCommit ||
      repair?.changedFiles !== 1 ||
      !sameStrings(repair?.changedPaths, [DRILL_PATH]) ||
      !Array.isArray(repair?.repairedJobs) ||
      !repair.repairedJobs.some(job =>
        job?.name === 'agent-repair-drill' &&
        job.conclusion === 'success' &&
        job.runId === drill.runId)) {
    return reject('CONTROLLED_REPAIR_SCOPE_OR_RESULT_INVALID');
  }

  if (evidence.regression?.status !== 'PASS' ||
      evidence.regression?.fullJest !== 'PASS' ||
      evidence.regression?.pythonSyntax !== 'PASS') {
    return reject('REGRESSION_EVIDENCE_NOT_PASS');
  }

  const factory = evidence.factoryAcceptance;
  if (factory?.status !== 'PASS' ||
      factory.commit !== currentCommit ||
      factory.productFactoryJob !== 'windows-product-factory' ||
      factory.productFactoryConclusion !== 'success' ||
      factory.runId !== finding.sourceRunId ||
      factory.workflowConclusion !== 'failure' ||
      !sameStrings(factory.workflowFailureJobs, FAILED_EVIDENCE_JOBS)) {
    return reject('SOURCE_FACTORY_ACCEPTANCE_PROVENANCE_INVALID');
  }

  return { valid: true, reason: 'CONTROLLED_REPAIR_DRILL_AND_SAME_COMMIT_PRODUCT_ACCEPTANCE_VERIFIED' };
}

function buildControlledDrillEvidence({ commit, missionId, triggerRun, preflightRunId, drillRunId, injectedResult, repairedResult }) {
  const failedJobs = [...FAILED_EVIDENCE_JOBS].sort();
  return {
    type: TYPE,
    status: 'PASS',
    mode: 'controlled-drill',
    commit,
    createdAt: new Date().toISOString(),
    missionId,
    finding: {
      sourceRunId: Number(triggerRun.id),
      preflightRunId: Number(preflightRunId),
      sourceCommit: commit,
      failedJobs,
      failedSteps: [
        'runtime-evidence-qualification: ci-feedback evidence unavailable',
        'release-gate: qualification incomplete'
      ],
      sourceRunUrl: triggerRun.html_url
    },
    drill: {
      runId: Number(drillRunId),
      injectedFailureObserved: true,
      injectedExitCode: 1,
      injectedResult,
      expectedResult: 1200,
      repairObserved: true,
      repairedExitCode: 0,
      repairedResult
    },
    repair: {
      previousCommit: commit,
      commit,
      changedFiles: 1,
      changedPaths: [DRILL_PATH],
      repairedJobs: [{ name: 'agent-repair-drill', conclusion: 'success', runId: Number(drillRunId) }]
    },
    regression: { status: 'PASS', fullJest: 'PASS', pythonSyntax: 'PASS' },
    factoryAcceptance: {
      status: 'PASS',
      runId: Number(triggerRun.id),
      commit,
      productFactoryJob: 'windows-product-factory',
      productFactoryConclusion: 'success',
      workflowConclusion: 'failure',
      workflowFailureJobs: failedJobs,
      url: triggerRun.html_url
    }
  };
}

async function getJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: 'Bearer ' + token
    }
  });
  if (!response.ok) throw new Error('GITHUB_API_' + response.status + ':' + url);
  return response.json();
}

async function runPreflightFromEnvironment() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) throw new Error('GITHUB_READ_CONTEXT_MISSING');

  const prNumber = Number(process.env.INPUT_TARGET_PR_NUMBER);
  const targetHeadSha = process.env.INPUT_TARGET_HEAD_SHA;
  const failedFactoryRunId = Number(process.env.INPUT_FAILED_FACTORY_RUN_ID);
  const baseUrl = 'https://api.github.com/repos/' + repository;
  const [pullRequest, sourceRun, jobsPage] = await Promise.all([
    getJson(baseUrl + '/pulls/' + prNumber, token),
    getJson(baseUrl + '/actions/runs/' + failedFactoryRunId, token),
    getJson(baseUrl + '/actions/runs/' + failedFactoryRunId + '/jobs?per_page=100', token)
  ]);

  const checked = validatePreflight({
    ref: process.env.GITHUB_REF,
    optIn: process.env.INPUT_OPT_IN,
    repository,
    prNumber,
    targetHeadSha,
    failedFactoryRunId,
    pullRequest,
    sourceRun,
    jobs: jobsPage.jobs
  });

  if (!checked.ok) {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_REPAIR_OPT_IN', status: 'BLOCKED', reason: checked.reason }));
    process.exitCode = 2;
    return;
  }

  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT_MISSING');
  fs.appendFileSync(outputPath, [
    'target_branch=' + checked.targetBranch,
    'target_head_sha=' + checked.targetHeadSha,
    'failed_factory_run_id=' + checked.failedFactoryRunId,
    'failed_factory_run_url=' + checked.failedFactoryRunUrl,
    'failed_jobs=' + JSON.stringify(checked.failedJobs)
  ].join('\n') + '\n');

  console.log(JSON.stringify({
    type: 'AUTONOMOUS_REPAIR_OPT_IN',
    status: 'PASS',
    reason: checked.reason,
    targetPr: prNumber,
    targetBranch: checked.targetBranch,
    targetHeadSha: checked.targetHeadSha,
    failedFactoryRunId: checked.failedFactoryRunId,
    failedJobs: checked.failedJobs
  }, null, 2));
}

async function runBaselineFactoryAndWait() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.TARGET_BRANCH;
  const targetSha = process.env.TARGET_HEAD_SHA;
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!repository || !token || !branch || ['main', 'master'].includes(branch) ||
      !/^[0-9a-f]{40}$/i.test(targetSha || '') || !outputPath) {
    throw new Error('BASELINE_FACTORY_CONTEXT_INVALID');
  }

  const baseUrl = 'https://api.github.com/repos/' + repository;
  const before = await getJson(
    baseUrl + '/actions/workflows/final-product-factory.yml/runs?branch=' + encodeURIComponent(branch) + '&per_page=30',
    token
  );
  const knownRuns = new Set((before.workflow_runs || []).map(run => Number(run.id)));
  const dispatch = await fetch(baseUrl + '/actions/workflows/final-product-factory.yml/dispatches', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ref: branch })
  });
  if (!dispatch.ok && dispatch.status !== 204) {
    throw new Error('BASELINE_FACTORY_DISPATCH_FAILED:' + dispatch.status);
  }

  for (let attempt = 1; attempt <= 180; attempt += 1) {
    const page = await getJson(
      baseUrl + '/actions/workflows/final-product-factory.yml/runs?branch=' + encodeURIComponent(branch) + '&per_page=30',
      token
    );
    const run = (page.workflow_runs || [])
      .filter(item => !knownRuns.has(Number(item.id)) &&
        item.event === 'workflow_dispatch' && item.head_sha === targetSha &&
        item.head_branch === branch)
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0];

    if (run && run.status === 'completed') {
      const jobsPage = await getJson(baseUrl + '/actions/runs/' + run.id + '/jobs?per_page=100', token);
      const checked = validateBaselineFactoryRun({ run, jobs: jobsPage.jobs, targetBranch: branch, targetHeadSha: targetSha });
      if (!checked.ok) {
        console.error(JSON.stringify({ type: 'AUTONOMOUS_REPAIR_BASELINE_FACTORY', status: 'BLOCKED', reason: checked.reason, url: run.html_url }));
        throw new Error('BASELINE_FACTORY_NOT_EVIDENCE_ONLY_FAILURE:' + checked.reason);
      }
      fs.appendFileSync(outputPath, [
        'baseline_factory_run_id=' + Number(run.id),
        'baseline_factory_run_url=' + run.html_url
      ].join('\n') + '\n');
      console.log(JSON.stringify({
        type: 'AUTONOMOUS_REPAIR_BASELINE_FACTORY',
        status: 'PASS',
        runId: Number(run.id),
        commit: run.head_sha,
        failedJobs: checked.failedJobs,
        url: run.html_url
      }, null, 2));
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  throw new Error('BASELINE_FACTORY_TIMEOUT');
}

function validateBaselineFactoryRun({ run, jobs, targetBranch, targetHeadSha }) {
  const reject = reason => ({ ok: false, reason });
  if (!run || run.name !== 'Final Product Factory' ||
      run.path !== '.github/workflows/final-product-factory.yml' ||
      run.event !== 'workflow_dispatch' ||
      run.status !== 'completed' ||
      run.conclusion !== 'failure' ||
      run.head_branch !== targetBranch ||
      run.head_sha !== targetHeadSha) {
    return reject('BASELINE_RUN_IDENTITY_OR_SHA_INVALID');
  }
  if (!Array.isArray(jobs) || jobs.length === 0) return reject('BASELINE_RUN_JOBS_MISSING');
  const failed = jobs.filter(job => job.conclusion === 'failure').map(job => job.name);
  if (!sameStrings(failed, FAILED_EVIDENCE_JOBS)) return reject('BASELINE_FAILURE_SCOPE_NOT_EVIDENCE_ONLY');
  for (const name of REQUIRED_ACCEPTANCE_JOBS) {
    if (!jobs.some(job => job.name === name && job.conclusion === 'success')) {
      return reject('BASELINE_ACCEPTANCE_JOB_NOT_GREEN:' + name);
    }
  }
  return { ok: true, reason: 'BASELINE_SAME_SHA_PRODUCT_ACCEPTANCE_PASS_EVIDENCE_GATE_BLOCKED', failedJobs: [...failed].sort() };
}

async function dispatchFactoryAndWait() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  const branch = process.env.TARGET_BRANCH;
  const targetSha = process.env.TARGET_HEAD_SHA;
  const repairRunId = Number(process.env.REPAIR_WORKFLOW_RUN_ID);
  if (!repository || !token || !branch || ['main', 'master'].includes(branch) ||
      !/^[0-9a-f]{40}$/i.test(targetSha || '') ||
      !Number.isSafeInteger(repairRunId) || repairRunId < 1) {
    throw new Error('FACTORY_DISPATCH_CONTEXT_INVALID');
  }

  const baseUrl = 'https://api.github.com/repos/' + repository;
  const repairRun = await getJson(baseUrl + '/actions/runs/' + repairRunId, token);
  if (repairRun.path !== '.github/workflows/autonomous-ci-repair-optin.yml' ||
      repairRun.event !== 'workflow_dispatch' ||
      repairRun.head_branch !== 'main' ||
      repairRun.status !== 'in_progress' ||
      repairRun.head_repository?.full_name !== repository) {
    throw new Error('UNTRUSTED_OR_INACTIVE_OPT_IN_REPAIR_RUN');
  }
  const repairJobs = await getJson(baseUrl + '/actions/runs/' + repairRunId + '/jobs?per_page=100', token);
  if (!(repairJobs.jobs || []).some(job => job.name === 'repair-drill' && job.conclusion === 'success')) {
    throw new Error('CONTROLLED_REPAIR_DRILL_JOB_NOT_SUCCESSFUL');
  }

  const before = await getJson(
    baseUrl + '/actions/workflows/final-product-factory.yml/runs?branch=' + encodeURIComponent(branch) + '&per_page=30',
    token
  );
  const knownRuns = new Set((before.workflow_runs || []).map(run => Number(run.id)));

  const dispatch = await fetch(baseUrl + '/actions/workflows/final-product-factory.yml/dispatches', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref: branch,
      inputs: {
        agent_repair_run_id: String(repairRunId),
        expected_head_sha: targetSha
      }
    })
  });
  if (!dispatch.ok && dispatch.status !== 204) {
    throw new Error('FINAL_FACTORY_DISPATCH_FAILED:' + dispatch.status);
  }

  for (let attempt = 1; attempt <= 180; attempt += 1) {
    const page = await getJson(
      baseUrl + '/actions/workflows/final-product-factory.yml/runs?branch=' + encodeURIComponent(branch) + '&per_page=30',
      token
    );
    const run = (page.workflow_runs || [])
      .filter(item => !knownRuns.has(Number(item.id)) &&
        item.event === 'workflow_dispatch' && item.head_sha === targetSha &&
        item.head_branch === branch)
      .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0];

    if (run && run.status === 'completed') {
      if (run.conclusion !== 'success') {
        console.error(JSON.stringify({
          type: 'AUTONOMOUS_REPAIR_OPT_IN_FACTORY',
          status: 'FAIL',
          runId: run.id,
          conclusion: run.conclusion,
          url: run.html_url
        }));
        throw new Error('FINAL_FACTORY_AFTER_DRILL_NOT_GREEN:' + run.html_url);
      }
      console.log(JSON.stringify({
        type: 'AUTONOMOUS_REPAIR_OPT_IN_FACTORY',
        status: 'PASS',
        runId: run.id,
        commit: run.head_sha,
        url: run.html_url
      }, null, 2));
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  throw new Error('FINAL_FACTORY_AFTER_DRILL_TIMEOUT');
}

if (require.main === module) {
  const mode = process.argv[2];
  const operation = mode === 'preflight'
    ? runPreflightFromEnvironment()
    : mode === 'baseline-and-wait'
      ? runBaselineFactoryAndWait()
      : mode === 'dispatch-and-wait'
        ? dispatchFactoryAndWait()
        : Promise.reject(new Error('OPT_IN_POLICY_MODE_INVALID'));
  operation.catch(error => {
    console.error(JSON.stringify({ type: 'AUTONOMOUS_REPAIR_OPT_IN', status: 'BLOCKED', error: error.message }));
    process.exitCode = 2;
  });
}

module.exports = {
  TYPE,
  TRUSTED_REF,
  TARGET_BASE_BRANCH,
  OPT_IN_VALUE,
  FAILED_EVIDENCE_JOBS,
  REQUIRED_ACCEPTANCE_JOBS,
  DRILL_PATH,
  validatePreflight,
  validateBaselineFactoryRun,
  injectControlledDefect,
  validateControlledDrillEvidence,
  buildControlledDrillEvidence
};
