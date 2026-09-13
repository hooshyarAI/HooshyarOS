const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const manifestPath = path.join(root, 'Docs', 'Product', 'PRODUCT_PLATFORM_MANIFEST.json');
const matrixPath = path.join(root, 'Docs', 'Product', 'PRODUCT_QUALIFICATION_MATRIX.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function fail(message) {
  console.error(JSON.stringify({ type: 'PRODUCT_PLATFORM_ASSURANCE', status: 'BLOCKED', error: message }, null, 2));
  process.exit(1);
}

for (const file of [manifestPath, matrixPath]) {
  if (!fs.existsSync(file)) fail(`MISSING_CONTRACT:${path.relative(root, file)}`);
}

const manifest = readJson(manifestPath);
const matrix = readJson(matrixPath);

if (manifest.product !== 'HooshyarOS') fail('MANIFEST_PRODUCT_MISMATCH');
if (!Array.isArray(manifest.layers) || manifest.layers.length < 8) fail('MANIFEST_LAYERS_INCOMPLETE');
if (!Array.isArray(manifest.environments) || !['windows', 'web', 'android'].every(x => manifest.environments.includes(x))) fail('MANIFEST_ENVIRONMENTS_INCOMPLETE');
if (!Array.isArray(matrix.required) || matrix.required.length < 10) fail('QUALIFICATION_MATRIX_INCOMPLETE');

const ids = matrix.required.map(cell => cell.id);
if (new Set(ids).size !== ids.length) fail('QUALIFICATION_MATRIX_DUPLICATE_IDS');
if (matrix.completion?.productComplete !== false) fail('PRODUCT_COMPLETE_FLAG_MUST_DEFAULT_FALSE');

const requiredFiles = [
  'Docs/HOOSHYAROS_MASTER_CHARTER.md',
  'Docs/COMMERCIAL_PRODUCT_COMPLETION_CONTRACT.md',
  'Backend/HBOS/Autonomous/Runtime/start-commercial-runtime.ts',
  'Backend/HBOS/Product/SQLitePersistenceStore.ts',
  'Backend/HBOS/Autonomous/Product/FinalProductFactoryRunner.ts'
];

const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(root, file)));
if (missingFiles.length) fail(`REQUIRED_PRODUCT_FILES_MISSING:${missingFiles.join(',')}`);

const output = {
  type: 'PRODUCT_PLATFORM_ASSURANCE',
  status: 'PASS',
  manifestLayers: manifest.layers.length,
  environments: manifest.environments,
  qualificationCells: matrix.required.length,
  productComplete: matrix.completion.productComplete,
  requiredFiles: requiredFiles.length,
  completionPolicy: 'runtime + application + acceptance + CI evidence required'
};
console.log(JSON.stringify(output, null, 2));
