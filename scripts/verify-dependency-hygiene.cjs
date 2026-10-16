#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const packages = lock.packages || {};
const failures = [];

function major(version) {
  const match = String(version || '').match(/^(\d+)/);
  return match ? Number(match[1]) : NaN;
}
function tuple(version) {
  return String(version || '').split('.').map(part => Number.parseInt(part, 10) || 0);
}
function allNamed(name) {
  const suffix = `/node_modules/${name}`;
  return Object.entries(packages)
    .filter(([location]) => location === `node_modules/${name}` || location.endsWith(suffix))
    .map(([location, info]) => ({ location, version: info.version }));
}
function requireRoot(name, expected) {
  const actual = packages[`node_modules/${name}`]?.version;
  if (actual !== expected) failures.push(`${name}: expected root version ${expected}, found ${actual || 'MISSING'}`);
}
function requireMinMajor(name, minimum) {
  const legacy = allNamed(name).filter(item => !Number.isFinite(major(item.version)) || major(item.version) < minimum);
  if (legacy.length) failures.push(`${name}: unsupported legacy versions: ${legacy.map(x => `${x.location}@${x.version}`).join(', ')}`);
}

requireRoot('exceljs-hardened', '5.0.2');
requireRoot('archiver', '8.0.0');
requireRoot('unzipper', '0.12.5');
requireRoot('test-exclude', '8.0.0');
if (manifest.dependencies?.['exceljs-hardened'] !== '5.0.2') {
  failures.push('package.json must pin exceljs-hardened@5.0.2');
}
if (manifest.overrides?.['test-exclude'] !== '8.0.0') {
  failures.push('package.json must override test-exclude to 8.0.0');
}
requireMinMajor('glob', 11);
requireMinMajor('rimraf', 4);

const oldMinimatch = allNamed('minimatch').filter(({ version }) => {
  const [maj, min, patch] = tuple(version);
  return !Number.isFinite(maj) || maj < 6 || (maj === 6 && (min < 2 || (min === 2 && patch < 2)));
});
if (oldMinimatch.length) {
  failures.push(`minimatch: vulnerable legacy versions: ${oldMinimatch.map(x => `${x.location}@${x.version}`).join(', ')}`);
}
for (const name of ['fstream', 'inflight']) {
  const found = allNamed(name);
  if (found.length) failures.push(`${name}: legacy dependency remains: ${found.map(x => `${x.location}@${x.version}`).join(', ')}`);
}

const summary = {
  type: 'DEPENDENCY_HYGIENE',
  status: failures.length ? 'BLOCKED' : 'PASS',
  exceljsHardened: packages['node_modules/exceljs-hardened']?.version || null,
  archiver: packages['node_modules/archiver']?.version || null,
  unzipper: packages['node_modules/unzipper']?.version || null,
  testExclude: packages['node_modules/test-exclude']?.version || null,
  globVersions: allNamed('glob').map(x => x.version),
  minimatchVersions: allNamed('minimatch').map(x => x.version),
  legacyPackageCount: allNamed('fstream').length + allNamed('inflight').length,
  failures
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
