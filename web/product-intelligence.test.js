const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('Product intelligence user surface contract', () => {
  const app = read('web/app.js');

  test('parses the shipped app script as valid JavaScript', () => {
    expect(() => new vm.Script(app, { filename: 'web/app.js' })).not.toThrow();
  });

  test('prefers the question-specific server answer and keeps the local builder as fallback', () => {
    // The runtime composes a question-specific answer; the UI must render it
    // verbatim instead of rebuilding a generic metric summary client-side.
    expect(app).toContain('const serverAnswer =');
    expect(app).toContain('payload.answer');
    expect(app).toContain('buildFinancialAssistantAnswer');
  });

  test('propagates governed finding groups into the statement insight surface', () => {
    expect(app).toContain('statusMeta.findings');
    expect(app).toContain('buildUserFacingFindingGroups');
    expect(app).toContain('insights.presentation');
    expect(app).toContain('latest.presentation');
  });

  test('does not imply transaction-level analysis when no transaction was extracted', () => {
    expect(app).toContain('بدون تراکنش استخراج‌شده');
    // READY is rendered as Persian, not as the raw internal status token.
    expect(app).toContain("analysis.status === 'READY' ? 'آماده'");
  });

  test('never presents an unassigned, undated execution card as a complete plan', () => {
    expect(app).toContain('تعیین‌نشده');
    expect(app).toContain('این کار هنوز کامل برنامه‌ریزی نشده است');
  });

  test('renders the composed answer without re-parsing its exact numbers', () => {
    // Passing the composed answer through the numeric re-localizer would parse
    // scientific notation and round the exact magnitude (32,129,418,000,000 ->
    // 32,129,400,000,000). The server answer is already Persian and exact.
    expect(app).toContain('result.textContent = serverAnswer');
    expect(app).not.toContain('localizeFinancialText(payload.answer');
  });
});
