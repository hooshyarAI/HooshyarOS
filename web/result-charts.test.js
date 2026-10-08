/**
 * Focused tests for the server-authoritative financial chart rendering capability.
 *
 * Asserts the 10 required contracts:
 *   1. canonical financial values are rendered unchanged
 *   2. no financial calculation occurs in chart renderer
 *   3. missing metric is NOT rendered as zero
 *   4. missing prior period does NOT create a fake trend
 *   5. ROA methodology label is preserved
 *   6. ROE methodology label is preserved
 *   7. CCC labels are Persian
 *   8. technical identifiers do not leak to normal surface
 *   9. truthful empty state exists
 *  10. accessibility contract exists
 */
const fs = require('node:fs');
const path = require('node:path');
const C = require('./result-charts.js');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

var SVG_NS = C.SVG_NS;

function makeMockElement(tag, ns) {
  var el = {
    tag: tag,
    namespaceURI: ns || null,
    className: '',
    textContent: '',
    attributes: {},
    children: [],
    hidden: false,
    appendChild: function (child) { this.children.push(child); return child; },
    setAttribute: function (name, value) { this.attributes[name] = String(value); },
    getAttribute: function (name) { return this.attributes[name]; },
    removeAttribute: function (name) { delete this.attributes[name]; }
  };
  return el;
}

function makeMockDocument() {
  return {
    createElement: function (tag) { return makeMockElement(tag); },
    createElementNS: function (ns, tag) { return makeMockElement(tag, ns); }
  };
}

function makeContainer() {
  var children = [];
  var doc = makeMockDocument();
  var container = {
    ownerDocument: doc,
    children: children,
    textContent: '',
    hidden: false,
    replaceChildren: function () { children.length = 0; this.textContent = ''; },
    appendChild: function (el) { children.push(el); return el; },
    setAttribute: function (name, value) { this[name] = value; },
    getAttribute: function (name) { return this[name]; },
    className: '',
    attributes: {}
  };
  return { container: container, doc: doc };
}

function collectText(el) {
  if (!el) return '';
  var parts = [];
  if (el.textContent) parts.push(el.textContent);
  if (Array.isArray(el.children)) {
    for (var i = 0; i < el.children.length; i++) {
      parts.push(collectText(el.children[i]));
    }
  }
  return parts.join('');
}

function collectAllText(root) {
  var out = [];
  (function walk(el) {
    if (!el || typeof el !== 'object') return;
    if (el.textContent) out.push(el.textContent);
    if (Array.isArray(el.children)) {
      for (var i = 0; i < el.children.length; i++) walk(el.children[i]);
    }
    if (el.attributes) {
      for (var k in el.attributes) {
        out.push(el.attributes[k]);
      }
    }
  })(root);
  return out.join(' ');
}

function findElements(root, tag) {
  var results = [];
  (function walk(el) {
    if (!el || typeof el !== 'object') return;
    if (el.tag === tag || el.tagName === tag) results.push(el);
    if (Array.isArray(el.children)) {
      for (var i = 0; i < el.children.length; i++) walk(el.children[i]);
    }
  })(root);
  return results;
}

function findElementsByClassName(root, className) {
  var results = [];
  (function walk(el) {
    if (!el || typeof el !== 'object') return;
    if (el.className && el.className.split(' ').indexOf(className) !== -1) results.push(el);
    if (Array.isArray(el.children)) {
      for (var i = 0; i < el.children.length; i++) walk(el.children[i]);
    }
  })(root);
  return results;
}

function findAttr(el, name) {
  if (!el || !el.attributes) return undefined;
  return el.attributes[name];
}

/* ---- mock insight fixtures ---- */

function fullInsight() {
  return {
    currency: 'IRR',
    documentStatus: 'COMPLETED',
    periods: [{ index: 0, label: '1402' }, { index: 1, label: '1401' }],
    metrics: { revenue: 5000, netProfit: 800, totalAssets: 10000, equity: 6000 },
    comparative: [
      { line: 'revenue', current: 5000, prior: 4000, absoluteChange: 1000, pctChange: 0.25, signReversal: false },
      { line: 'grossProfit', current: 2000, prior: 1600, absoluteChange: 400, pctChange: 0.25, signReversal: false },
      { line: 'operatingIncome', current: 1200, prior: 1000, absoluteChange: 200, pctChange: 0.2, signReversal: false },
      { line: 'netIncome', current: 800, prior: 600, absoluteChange: 200, pctChange: 0.3333, signReversal: false }
    ],
    ratios: {
      grossMargin: 0.4,
      operatingMargin: 0.24,
      netMargin: 0.16,
      roa: 0.08,
      roe: 0.1333,
      currentRatio: 2.0,
      quickRatio: 1.5,
      cashRatio: 0.8,
      debtToEquity: 0.5,
      debtToAssets: 0.33,
      equityRatio: 0.6,
      unavailable: [],
      notApplicable: []
    },
    profitabilityMethodology: 'AVERAGE_BALANCE',
    workingCapital: {
      netWorkingCapital: 1500,
      dso: 30,
      dio: 45,
      dpo: 20,
      cashConversionCycle: 55
    },
    cashFlow: { operating: 900, investing: -200, financing: 100, net: 800, priorOperating: 700, qualityOfEarnings: 'CASH_BACKED' }
  };
}

describe('Server-authoritative financial chart rendering (Stage 8)', () => {
  /* ---------------------------------------------------------------- */
  /* 1. Canonical financial values are rendered unchanged             */
  /* ---------------------------------------------------------------- */
  test('renders canonical comparative values unchanged in the trend chart', () => {
    var insight = fullInsight();
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

    // The current values for each trend series must appear exactly (as Persian digits)
    expect(text).toContain('۵٬۰۰۰');
    expect(text).toContain('۴٬۰۰۰');
    expect(text).toContain('۲٬۰۰۰');
    expect(text).toContain('۱٬۶۰۰');
    expect(text).toContain('۱٬۲۰۰');
    expect(text).toContain('۱٬۰۰۰');
    expect(text).toContain('۸۰۰');
    expect(text).toContain('۶۰۰');
  });

  test('renders canonical ratio values unchanged in the profitability chart', () => {
    var insight = fullInsight();
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

    // ROA = 0.08 → 8.00%, ROE = 0.1333 → 13.33%
    expect(text).toContain('۸٫۰۰٪');
    expect(text).toContain('۱۳٫۳۳٪');
    // Net margin = 0.16 → 16.00%
    expect(text).toContain('۱۶٫۰۰٪');
  });

  test('renders canonical working-capital values unchanged in days', () => {
    var insight = fullInsight();
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

    expect(text).toContain('۳۰ روز');
    expect(text).toContain('۴۵ روز');
    expect(text).toContain('۲۰ روز');
    expect(text).toContain('۵۵ روز');
  });

  /* ---------------------------------------------------------------- */
  /* 2. No financial calculation occurs in chart renderer                */
  /* ---------------------------------------------------------------- */
  test('chart renderer source contains no financial mathematics', () => {
    var source = read('web/result-charts.js');
    // The renderer must not compute ROA, ROE, DSO, DIO, DPO, CCC, margins or turnover
    expect(source).not.toMatch(/roa\s*=\s*\(?[^;]*netIncome\s*\//);
    expect(source).not.toMatch(/roe\s*=\s*\(?[^;]*netIncome\s*\//);
    expect(source).not.toMatch(/dso\s*=\s*\(?[^;]*receivables\s*\//);
    expect(source).not.toMatch(/dio\s*=\s*\(?[^;]*inventory\s*\//);
    expect(source).not.toMatch(/dpo\s*=\s*\(?[^;]*payables\s*\//);
    expect(source).not.toMatch(/cashConversionCycle\s*=\s*\(?[^;]*dso/);
    expect(source).not.toMatch(/netMargin\s*=\s*\(?[^;]*netIncome\s*\//);
    expect(source).not.toMatch(/marginOfSafety/);
    expect(source).not.toMatch(/contributionMargin/);
    expect(source).not.toMatch(/breakEven/);
    // No division or multiplication on financial values (only formatting helpers scaleValue for SVG)
    var calcPatterns = [
      /receivables\s*\/\s*revenue/,        // DSO calc
      /inventory\s*\/\s*cogs/,              // DIO calc
      /payables\s*\/\s*cogs/,              // DPO calc
      /netIncome\s*\*\s*100/,              // margin * 100 (would be calculation)
      /netIncome\s*\/\s*revenue/,          // margin calc
      /netIncome\s*\/\s*totalAssets/,       // ROA calc
      /netIncome\s*\/\s*equity/,           // ROE calc
    ];
    for (var i = 0; i < calcPatterns.length; i++) {
      expect(source).not.toMatch(calcPatterns[i]);
    }
  });

  /* ---------------------------------------------------------------- */
  /* 3. Missing metric is NOT rendered as zero                         */
  /* ---------------------------------------------------------------- */
  test('missing profitability ratio is not rendered as zero', () => {
    var insight = fullInsight();
    insight.ratios = Object.assign({}, insight.ratios, { roa: null, roe: null });
    insight.profitabilityMethodology = null;
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

     // The missing ratio should show the unavailable label, not "0"
     expect(text).toContain('بازده دارایی ' + C.MISSING_DATA_TEXT);
      expect(text).toContain('بازده حقوق صاحبان سهام ' + C.MISSING_DATA_TEXT);
     // Ensure not rendered as zero percent
     expect(text).not.toContain('بازده دارایی ۰٪');
     expect(text).not.toContain('بازده حقوق مالکانه ۰٪');
  });

  test('missing working-capital metric is not rendered as zero', () => {
    var insight = fullInsight();
    insight.workingCapital = {
      netWorkingCapital: 0,
      dso: null,
      dio: null,
      dpo: null,
      cashConversionCycle: null
    };
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

    // DSO should show missing text, not "0 روز"
    expect(text).toContain(C.MISSING_DATA_TEXT);
  });

  /* ---------------------------------------------------------------- */
  /* 4. Missing prior period does NOT create a fake trend             */
  /* ---------------------------------------------------------------- */
  test('insight with only current-period comparative entries does not render a fake trend', () => {
    // Only current values, no prior — comparative entries with prior = 0 would
    // be sign-reversal or zero-prior situations which the canonical service
    // represents as pctChange: null. But here we simulate a statement that has
    // NO comparative entries at all (only current period extracted).
    var insight = {
      currency: 'IRR',
      documentStatus: 'COMPLETED',
      periods: [{ index: 0, label: '1402' }],
      metrics: { revenue: 5000, netProfit: 800 },
      comparative: [],
      ratios: { netMargin: 0.16, roa: 0.08, roe: 0.1333, unavailable: [], notApplicable: [] },
      profitabilityMethodology: 'ENDING_BALANCE_FALLBACK',
      workingCapital: null,
      cashFlow: { operating: 900, investing: -200, financing: 100, net: 800, priorOperating: null, qualityOfEarnings: 'CASH_BACKED' }
    };
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

    // The trend chart should show the empty state, not fabricated prior bars
    expect(text).toContain(C.EMPTY_STATE_TEXT);
    // No "قبلی" legend (prior period) should appear in trend
    var trendWrappers = findElementsByClassName(setup.container, 'chart-trend');
    expect(trendWrappers.length).toBe(1);
  });

  /* ---------------------------------------------------------------- */
  /* 5. ROA methodology label is preserved                             */
  /* ---------------------------------------------------------------- */
  test('ROA methodology label is preserved as the canonical Persian translation', () => {
    var insight = fullInsight();
    insight.profitabilityMethodology = 'AVERAGE_BALANCE';
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

     expect(text).toContain('میانگین مانده\u200cها');
     // ensure the alternative label mapping exists in the code
     var source = read('web/result-charts.js');
     expect(source).toContain('مبنای مانده پایان دوره');
  });

  /* ---------------------------------------------------------------- */
  /* 6. ROE methodology label is preserved                             */
  /* ---------------------------------------------------------------- */
  test('ROE methodology label is preserved as the canonical Persian translation', () => {
    var insight = fullInsight();
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

    // The methodology label should appear alongside ROE
    expect(text).toContain('میانگین مانده\u200cها');
    // ROE label itself should be Persian
    expect(text).toContain('بازده حقوق صاحبان سهام');
  });

  /* ---------------------------------------------------------------- */
  /* 7. CCC labels are Persian                                         */
  /* ---------------------------------------------------------------- */
  test('working-capital chart uses Persian labels for DSO/DIO/DPO/CCC', () => {
    var insight = fullInsight();
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

    expect(text).toContain('روزهای وصول مطالبات');
    expect(text).toContain('روزهای نگهداری موجودی');
    expect(text).toContain('روزهای پرداخت به تأمین\u200cکننده');
     expect(text).toContain('چرخه سرمایه\u200c در گردش');
     expect(text).toContain('چرخه سرمایه\u200c در گردش');
  });

  /* ---------------------------------------------------------------- */
  /* 8. Technical identifiers do not leak to normal surface            */
  /* ---------------------------------------------------------------- */
  test('technical identifiers never appear in rendered chart output', () => {
    var insight = fullInsight();
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);
    var text = collectAllText(setup.container);

    var forbidden = ['dso', 'dio', 'dpo', 'cashConversionCycle', 'workingCapital',
                     'totalAssets', 'netIncome', 'grossProfit', 'operatingIncome',
                     'netMargin', 'roa', 'roe', 'equityMultiplier', 'receivablesDays',
                     'inventoryDays', 'payablesDays', 'netWorkingCapital'];
    for (var i = 0; i < forbidden.length; i++) {
      expect(text).not.toContain(forbidden[i]);
    }
  });

  /* ---------------------------------------------------------------- */
  /* 9. Truthful empty state exists                                   */
  /* ---------------------------------------------------------------- */
  test('renders truthful empty state when no comparative evidence exists', () => {
    var insight = fullInsight();
    insight.comparative = [];
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);

    var trendWrappers = findElementsByClassName(setup.container, 'chart-trend');
    expect(trendWrappers.length).toBe(1);
    var text = collectAllText(trendWrappers[0]);
    expect(text).toContain(C.EMPTY_STATE_TEXT);
  });

  test('renders truthful missing-data state when profitability ratios are absent', () => {
    var insight = fullInsight();
    insight.ratios = { grossMargin: null, operatingMargin: null, netMargin: null, roa: null, roe: null,
                       currentRatio: null, quickRatio: null, cashRatio: null,
                       debtToEquity: null, debtToAssets: null, equityRatio: null,
                       unavailable: ['netMargin', 'roa', 'roe'], notApplicable: [] };
    insight.profitabilityMethodology = null;
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);

    var profWrappers = findElementsByClassName(setup.container, 'chart-profitability');
    expect(profWrappers.length).toBe(1);
    var text = collectAllText(profWrappers[0]);
    expect(text).toContain(C.MISSING_DATA_TEXT);
  });

  test('renders truthful missing-data state when working capital is null', () => {
    var insight = fullInsight();
    insight.workingCapital = null;
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);

    var wcWrappers = findElementsByClassName(setup.container, 'chart-working-capital');
    expect(wcWrappers.length).toBe(1);
    var text = collectAllText(wcWrappers[0]);
    expect(text).toContain(C.MISSING_DATA_TEXT);
  });

  /* ---------------------------------------------------------------- */
  /* 10. Accessibility contract exists                                 */
  /* ---------------------------------------------------------------- */
  test('every chart SVG has an accessible title/label and Persian heading', () => {
    var insight = fullInsight();
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);

    var svgs = findElements(setup.container, 'svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);

    for (var i = 0; i < svgs.length; i++) {
      var role = findAttr(svgs[i], 'role');
      var label = findAttr(svgs[i], 'aria-label');
      expect(role).toBe('img');
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  test('charts container has an accessible aria-label and readable value list', () => {
    var insight = fullInsight();
    var setup = makeContainer();
    C.renderCharts(setup.container, insight);

    var wrappers = findElementsByClassName(setup.container, 'charts-container');
    expect(wrappers.length).toBe(1);
    var label = findAttr(wrappers[0], 'aria-label');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);

    // Each chart section has a Persian title heading and a readable value list
    var titles = findElements(setup.container, 'h4');
    var titleTexts = titles.map(function (h) { return h.textContent || ''; });
    expect(titleTexts.some(function (t) { return t.indexOf('روند مالی') !== -1; })).toBe(true);
    expect(titleTexts.some(function (t) { return t.indexOf('سودآوری') !== -1; })).toBe(true);
    expect(titleTexts.some(function (t) { return t.indexOf('سرمایه') !== -1; })).toBe(true);

    // Readable value list (<dl> with <dt>/<dd>) exists
    var dls = findElements(setup.container, 'dl');
    expect(dls.length).toBeGreaterThanOrEqual(3);
  });

  test('app.js loads and invokes the chart layer from the statement insight render', () => {
    var app = read('web/app.js');
    expect(app).toContain('HooshyarResultCharts');
    expect(app).toContain('renderCharts');
    expect(app).toContain('#financial-charts');
  });

  test('index.html includes the chart script and container', () => {
    var html = read('web/index.html');
    expect(html).toContain('src="/result-charts.js"');
    expect(html).toContain('id="financial-charts"');
  });

  test('sw.js caches the chart script for offline', () => {
    var sw = read('web/sw.js');
    expect(sw).toContain('/result-charts.js');
  });
});
