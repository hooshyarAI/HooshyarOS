const fs = require('node:fs');
const path = require('node:path');
const P = require('./result-presentation.js');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

function makeContainer() {
  const children = [];
  const ownerDocument = {
    createElement(tag) {
      return {
        tag,
        className: '',
        textContent: '',
        children: [],
        appendChild(child) { this.children.push(child); return child; }
      };
    }
  };
  return {
    ownerDocument,
    children,
    textContent: '',
    replaceChildren() { children.length = 0; },
    appendChild(el) { children.push(el); return el; }
  };
}

describe('Result presentation layer (Persian-first, progressive disclosure)', () => {
  test('summarizes the executive workbench as human-readable Persian lines', () => {
    const presentation = P.summarizeExecutive({
      status: 'READY',
      kpis: { revenue: 2000, profit: 1200 },
      performance: { profitMargin: 0.3 },
      recommendations: [{ action: 'کاهش هزینه', rationale: 'بازدهی بالاتر' }]
    });
    expect(presentation.title).toBe('کارگاه هوش مدیریتی');
    expect(presentation.lines.join('\n')).toContain('وضعیت: READY');
    expect(presentation.lines.join('\n')).toContain('درآمد');
    expect(presentation.lines.join('\n')).not.toContain('{');
    expect(presentation.technical.status).toBe('READY');
  });

  test('renders title, plain lines, and evidence behind a details disclosure', () => {
    const container = makeContainer();
    P.renderResult(container, P.summarizeDecision({
      status: 'READY',
      recommendation: { alternative: 'طرح الف', score: 0.82 },
      consistency: { ratio: 0.05 }
    }));
    const title = container.children[0];
    const lineTexts = container.children.filter(c => c.className === 'result-line').map(c => c.textContent);
    const details = container.children.find(c => c.tag === 'details');
    expect(title.textContent).toBe('کارگاه تصمیم‌گیری');
    expect(lineTexts.length).toBeGreaterThan(0);
    expect(lineTexts.join('\n')).not.toContain('{');
    expect(details.className).toBe('result-evidence');
    const summary = details.children.find(c => c.tag === 'summary');
    const pre = details.children.find(c => c.tag === 'pre');
    expect(summary.textContent).toContain('جزئیات فنی');
    expect(pre.textContent).toContain('"status": "READY"');
  });

  test('never emits raw JSON into the normal surface on non-DOM fallback', () => {
    const container = { textContent: '' };
    P.renderResult(container, P.summarizeResilience({ status: 'READY', metric: 'revenue', statistics: { mean: 1000 } }));
    expect(container.textContent).not.toContain('{');
  });

  test('labels client-supplied analytics as unverified without implying verification', () => {
    const line = P.trustLine({
      inputTrust: { classification: 'UNVERIFIED_INFORMATION', source: 'CLIENT_SUPPLIED', canonicalBinding: false }
    });
    expect(line).toContain('اطلاعات تأییدنشده');
    expect(line).toContain('بدون اتصال به منبع معتبر');
    expect(P.summarizeImpact({
      status: 'READY',
      impact: { absoluteChange: 200 },
      inputTrust: { classification: 'UNVERIFIED_INFORMATION', source: 'CLIENT_SUPPLIED', canonicalBinding: false }
    }).lines.join('\n')).toContain('اطلاعات تأییدنشده');
  });

  test('formats numbers in Persian digits', () => {
    expect(P.faNumber(1234)).toMatch(/[۰-۹]/);
  });

  test('report summary keeps sections readable and full payload in evidence', () => {
    const presentation = P.summarizeReport({
      status: 'READY',
      title: 'گزارش مالی',
      sections: [{ title: 'ترازنامه' }, { title: 'سود و زیان' }],
      limitations: ['دوره مقایسه‌ای موجود نیست']
    });
    expect(presentation.lines.join('\n')).toContain('بخش‌ها: ۲ بخش');
    expect(presentation.lines.join('\n')).toContain('محدودیت‌ها');
    expect(presentation.technical.sections.length).toBe(2);
  });

  test('derives a truthful workspace context from the persisted latest analysis', () => {
    const context = P.deriveRestoredContext({
      source: { sourceName: 'صورت‌مالی.xlsx' },
      statementInsight: { documentStatus: 'COMPLETED', periods: [{ label: '1402' }, { label: '1401' }] }
    }, 'کامل');
    expect(context.title).toBe('ادامه از آخرین تحلیل');
    expect(context.source).toBe('صورت‌مالی.xlsx');
    expect(context.state).toBe('زمینه بازیابی‌شده');
    expect(context.description).toContain('کامل');
    expect(context.description).toContain('1402');
    expect(context.revealActions).toBe(true);
  });

  test('does not invent a restored context when nothing was persisted', () => {
    expect(P.deriveRestoredContext(null, 'کامل')).toBeNull();
    expect(P.deriveRestoredContext({ source: { sourceName: 'x' } }, 'کامل')).toBeNull();
  });

  test('app.js restores the workspace context rail from the persisted analysis', () => {
    const app = read('web/app.js');
    expect(app).toContain('restoreWorkspaceContextFromLatest');
    expect(app).toContain('deriveRestoredContext');
    expect(app).toContain('/api/financial/insights/latest');
  });

  test('app.js routes workspace results through the presentation layer, not raw JSON', () => {
    const app = read('web/app.js');
    expect(app).toContain('presentUserResult');
    expect(app).toContain('summarizeExecutive');
    expect(app).toContain('summarizeResilience');
    expect(app).not.toContain('result.textContent = JSON.stringify(');
  });

  test('index.html exposes result containers as accessible status regions and loads the layer', () => {
    const html = read('web/index.html');
    expect(html).toContain('src="/result-presentation.js"');
    for (const id of ['executive-result', 'decision-result', 'analytics-result', 'resilience-result', 'impact-result', 'improvement-result', 'report-result']) {
      expect(html).toContain(`id="${id}"`);
      expect(html).not.toContain(`<pre id="${id}"`);
    }
  });

  test('offline app shell caches the presentation layer', () => {
    const sw = read('web/sw.js');
    expect(sw).toContain('/result-presentation.js');
  });
});
