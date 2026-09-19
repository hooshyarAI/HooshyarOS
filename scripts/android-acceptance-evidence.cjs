#!/usr/bin/env node
'use strict';

/**
 * Canonical owner of the Android product acceptance evidence artifact.
 *
 * `.hooshyar/android-acceptance-success.json` is consumed by
 * `scripts/cline-runtime-evidence-collector.cjs`, which marks the
 * `android-release` qualification cell `PASS` only when the artifact is
 * commit-bound, `PASS` and structurally complete. The artifact therefore must
 * be produced by the harness that actually runs the device checks, never
 * hand-authored by a CI workflow: a hard-coded marker list is not evidence.
 *
 * Usage (driven by `scripts/android-product-acceptance.sh`):
 *   node scripts/android-acceptance-evidence.cjs begin
 *   node scripts/android-acceptance-evidence.cjs record <step>
 *   node scripts/android-acceptance-evidence.cjs complete
 *   node scripts/android-acceptance-evidence.cjs fail <reason>
 *   node scripts/android-acceptance-evidence.cjs verify
 *
 * Fail-closed guarantees:
 *   - `begin` clears any previous result (a failed re-run can never inherit a
 *     stale PASS);
 *   - `record` refuses unknown steps and refuses to append to a finished run;
 *   - `complete` refuses unless every required step was actually recorded;
 *   - `fail` deletes the artifact so no success evidence survives a failure;
 *   - `verify` refuses an artifact that is missing, not PASS, incomplete or not
 *     commit-bound.
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = process.cwd();
const EVIDENCE_ENV = 'HOOSHYAR_ANDROID_EVIDENCE_PATH';
const DEFAULT_EVIDENCE_PATH = path.join(ROOT, '.hooshyar', 'android-acceptance-success.json');
const EVIDENCE_TYPE = 'ANDROID_PRODUCT_ACCEPTANCE_SUCCESS';
const EVIDENCE_VERSION = 1;

/**
 * The real verification stages performed by the canonical Android acceptance
 * harness. `complete` refuses unless every one of these was recorded, so the
 * artifact cannot be produced from a hard-coded list.
 */
const REQUIRED_STEPS = Object.freeze([
    'apk-present',
    'device-online',
    'android-booted',
    'package-manager-ready',
    'apk-installed',
    'launcher-start',
    'process-alive',
    'main-activity-visible',
]);

function evidencePath() {
    const override = process.env[EVIDENCE_ENV];
    return override && override.trim() ? path.resolve(override.trim()) : DEFAULT_EVIDENCE_PATH;
}

function gitCommit() {
    try {
        return cp.execFileSync(process.platform === 'win32' ? 'git.exe' : 'git', ['rev-parse', 'HEAD'], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
    } catch {
        return 'UNKNOWN';
    }
}

function readEvidence(file = evidencePath()) {
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function writeEvidence(record, file = evidencePath()) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n', 'utf8');
    return record;
}

function begin(file = evidencePath()) {
    return writeEvidence({
        type: EVIDENCE_TYPE,
        version: EVIDENCE_VERSION,
        status: 'IN_PROGRESS',
        createdAt: new Date().toISOString(),
        repository: ROOT,
        commit: gitCommit(),
        acceptance: [],
    }, file);
}

function record(step, file = evidencePath()) {
    const normalized = String(step || '').trim();
    if (!REQUIRED_STEPS.includes(normalized)) {
        throw new Error(`ANDROID_ACCEPTANCE_UNKNOWN_STEP:${normalized}`);
    }
    const current = readEvidence(file);
    if (!current || current.type !== EVIDENCE_TYPE) {
        throw new Error('ANDROID_ACCEPTANCE_EVIDENCE_MISSING');
    }
    if (current.status !== 'IN_PROGRESS') {
        throw new Error(`ANDROID_ACCEPTANCE_EVIDENCE_NOT_IN_PROGRESS:${current.status}`);
    }
    const acceptance = Array.isArray(current.acceptance) ? current.acceptance.slice() : [];
    if (!acceptance.includes(normalized)) acceptance.push(normalized);
    return writeEvidence({ ...current, acceptance }, file);
}

function complete(file = evidencePath()) {
    const current = readEvidence(file);
    if (!current || current.type !== EVIDENCE_TYPE) {
        throw new Error('ANDROID_ACCEPTANCE_EVIDENCE_MISSING');
    }
    const acceptance = Array.isArray(current.acceptance) ? current.acceptance : [];
    const missing = REQUIRED_STEPS.filter((step) => !acceptance.includes(step));
    if (missing.length) {
        throw new Error(`ANDROID_ACCEPTANCE_EVIDENCE_INCOMPLETE:${missing.join(',')}`);
    }
    return writeEvidence({
        ...current,
        status: 'PASS',
        completedAt: new Date().toISOString(),
        acceptance: REQUIRED_STEPS.slice(),
    }, file);
}

function fail(reason, file = evidencePath()) {
    try {
        fs.rmSync(file, { force: true });
    } catch {
        /* removing stale evidence is best-effort; a stale PASS is never returned */
    }
    return {
        type: EVIDENCE_TYPE,
        status: 'BLOCKED',
        reason: String(reason || 'ANDROID_ACCEPTANCE_FAILED'),
    };
}

function verify(file = evidencePath()) {
    const current = readEvidence(file);
    if (!current) throw new Error('ANDROID_ACCEPTANCE_EVIDENCE_MISSING');
    if (current.type !== EVIDENCE_TYPE || current.status !== 'PASS') {
        throw new Error(`ANDROID_ACCEPTANCE_EVIDENCE_INVALID:${current.type}/${current.status}`);
    }
    const acceptance = Array.isArray(current.acceptance) ? current.acceptance : [];
    const missing = REQUIRED_STEPS.filter((step) => !acceptance.includes(step));
    if (missing.length) throw new Error(`ANDROID_ACCEPTANCE_EVIDENCE_INCOMPLETE:${missing.join(',')}`);
    if (!/^[0-9a-f]{7,40}$/i.test(String(current.commit || '').trim())) {
        throw new Error('ANDROID_ACCEPTANCE_EVIDENCE_UNBOUND');
    }
    return current;
}

function main(argv) {
    const [command, argument] = argv;
    switch (command) {
        case 'begin': {
            const artifact = begin();
            console.log(JSON.stringify({ type: artifact.type, status: artifact.status, commit: artifact.commit }));
            return 0;
        }
        case 'record': {
            const artifact = record(argument);
            console.log(JSON.stringify({ status: artifact.status, acceptance: artifact.acceptance }));
            return 0;
        }
        case 'complete': {
            const artifact = complete();
            console.log(JSON.stringify({ status: artifact.status, acceptance: artifact.acceptance }));
            return 0;
        }
        case 'fail': {
            console.log(JSON.stringify(fail(argument)));
            return 0;
        }
        case 'verify': {
            const artifact = verify();
            console.log(JSON.stringify({ status: artifact.status, commit: artifact.commit, acceptance: artifact.acceptance }));
            return 0;
        }
        default:
            console.error(JSON.stringify({ type: 'ANDROID_ACCEPTANCE_EVIDENCE', status: 'BLOCKED', error: `UNKNOWN_COMMAND:${command || ''}` }));
            return 2;
    }
}

if (require.main === module) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (error) {
        console.error(JSON.stringify({
            type: 'ANDROID_ACCEPTANCE_EVIDENCE',
            status: 'BLOCKED',
            error: error instanceof Error ? error.message : String(error),
        }));
        process.exitCode = 1;
    }
}

module.exports = {
    REQUIRED_STEPS,
    EVIDENCE_TYPE,
    EVIDENCE_VERSION,
    EVIDENCE_ENV,
    evidencePath,
    readEvidence,
    begin,
    record,
    complete,
    fail,
    verify,
};
