/**
 * result-presentation — framework-free Persian-first presentation layer for
 * workspace result surfaces.
 *
 * Purpose: normal users must see a simple, human-readable Persian summary.
 * Technical payloads remain available but only behind explicit progressive
 * disclosure ("جزئیات فنی و شواهد"). No private model reasoning is ever shown.
 *
 * This module is intentionally UMD-style so the shipped browser script and the
 * Node-based UI contract tests can both consume it without a build step.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HooshyarResultPresentation = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  const LABELS = {
    status: 'وضعیت',
    kpis: 'شاخص‌های کلیدی',
    performance: 'عملکرد',
    recommendations: 'توصیه‌ها',
    recommendation: 'توصیه',
    action: 'اقدام',
    rationale: 'دلیل',
    priority: 'اولویت',
    weightsSource: 'منبع وزن‌ها',
    consistency: 'سازگاری',
    ratio: 'نسبت سازگاری',
    evaluations: 'ارزیابی‌ها',
    alternative: 'گزینه',
    score: 'امتیاز',
    rank: 'رتبه',
    metric: 'شاخص',
    baseValue: 'مقدار پایه',
    simulationCount: 'تعداد شبیه‌سازی',
    scenarios: 'سناریوها',
    statistic: 'آماره',
    statistics: 'آماره‌ها',
    mean: 'میانگین',
    median: 'میانه',
    stdDev: 'انحراف معیار',
    standardDeviation: 'انحراف معیار',
    variance: 'واریانس',
    min: 'کمینه',
    max: 'بیشینه',
    p5: 'صدک ۵',
    p50: 'صدک ۵۰',
    p95: 'صدک ۹۵',
    percentile: 'صدک',
    valueAtRisk: 'ارزش در معرض ریسک',
    expectedShortfall: 'کمبود مورد انتظار',
    baseline: 'وضعیت پایه',
    post: 'وضعیت پس از اقدام',
    impact: 'اثر',
    delta: 'تغییر',
    absoluteChange: 'تغییر مطلق',
    pctChange: 'تغییر درصدی',
    percentageChange: 'تغییر درصدی',
    direction: 'جهت',
    improved: 'بهبود',
    domain: 'حوزه',
    actualImpact: 'اثر واقعی',
    expectedImpact: 'اثر انتظاری',
    currentState: 'وضعیت جاری',
    ratios: 'نسبت‌ها',
    verticalRows: 'ردیف‌های تحلیل عمودی',
    profitability: 'سودآوری',
    leverage: 'اهرم مالی',
    liquidity: 'نقدینگی',
    activity: 'فعالیت',
    breakEven: 'نقطه سربه‌سر',
    forecast: 'پیش‌بینی',
    naive: 'ساده',
    movingAverage: 'میانگین متحرک',
    linearTrend: 'روند خطی',
    anomalies: 'ناهنجاری‌ها',
    zscoreAlerts: 'هشدارهای Z',
    iqrAlerts: 'هشدارهای IQR',
    title: 'عنوان',
    summary: 'خلاصه',
    sections: 'بخش‌ها',
    revenue: 'درآمد',
    profit: 'سود',
    profitMargin: 'حاشیه سود',
    debtRatio: 'نسبت بدهی',
    source: 'منبع',
    sourceName: 'نام منبع',
    sourceType: 'نوع منبع',
    format: 'قالب',
    generatedAt: 'زمان تولید',
    transactionCount: 'تعداد تراکنش',
    ingestedTransactions: 'تراکنش‌های پردازش‌شده',
    confidence: 'اطمینان',
    limitations: 'محدودیت‌ها',
    evidence: 'شواهد',
    assumptions: 'فرض‌ها',
    inputTrust: 'اعتبار ورودی',
    classification: 'طبقه‌بندی',
    canonicalBinding: 'اتصال به منبع معتبر',
    sourceSha256: 'شناسه منبع',
    algorithm: 'الگوریتم',
    iterations: 'تکرارها',
    converged: 'همگرا',
    currency: 'واحد پول',
    unit: 'واحد',
    period: 'دوره',
    periods: 'دوره‌ها',
    note: 'یادداشت',
    notes: 'یادداشت‌ها',
    message: 'پیام'
  };

  const TRUST_LABELS = {
    UNVERIFIED_INFORMATION: 'اطلاعات تأییدنشده',
    CLIENT_SUPPLIED: 'ورودی کاربر',
    VERIFIED: 'تأییدشده',
    UNKNOWN: 'نامشخص'
  };

  function faNumber(value, options) {
    const number = Number(value);
    if (!Number.isFinite(number)) return String(value === null || value === undefined ? '—' : value);
    try {
      return number.toLocaleString('fa-IR', Object.assign({ maximumFractionDigits: 4 }, options || {}));
    } catch {
      return String(number);
    }
  }

  function humanizeKey(key) {
    if (LABELS[key]) return LABELS[key];
    const spaced = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  function describeValue(value, options) {
    const opts = options || {};
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return faNumber(value, opts.numberOptions);
    if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
    if (typeof value === 'string') {
      const localized = typeof opts.localize === 'function' ? opts.localize(value) : value;
      return localized === '' ? '—' : localized;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return 'خالی';
      if (value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
        return `${faNumber(value.length)} مورد: ${value.map(item => describeValue(item, opts)).join('، ')}`;
      }
      return `${faNumber(value.length)} مورد`;
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      return keys.length === 0 ? 'خالی' : `${faNumber(keys.length)} مورد`;
    }
    return String(value);
  }

  function buildLines(value, options) {
    const opts = options || {};
    const maxLines = opts.maxLines || 40;
    const maxDepth = opts.maxDepth || 3;
    const localize = opts.localize;
    const lines = [];

    function walk(node, prefix, depth) {
      if (lines.length >= maxLines) return;
      const isPrimitive = node === null || node === undefined || ['string', 'number', 'boolean'].includes(typeof node);
      if (isPrimitive) {
        lines.push(`${prefix}: ${describeValue(node, { localize })}`);
        return;
      }
      if (Array.isArray(node)) {
        if (node.length === 0) {
          lines.push(`${prefix}: خالی`);
          return;
        }
        const primitives = node.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item));
        if (primitives) {
          lines.push(`${prefix}: ${node.map(item => describeValue(item, { localize })).join('، ')}`);
          return;
        }
        if (depth >= maxDepth) {
          lines.push(`${prefix}: ${faNumber(node.length)} مورد`);
          return;
        }
        node.slice(0, 6).forEach((item, index) => {
          walk(item, `${prefix} ${faNumber(index + 1)}`, depth + 1);
        });
        if (node.length > 6) lines.push(`${prefix}: ${faNumber(node.length - 6)} مورد دیگر`);
        return;
      }
      const keys = Object.keys(node);
      if (keys.length === 0) {
        lines.push(`${prefix}: خالی`);
        return;
      }
      if (depth >= maxDepth) {
        lines.push(`${prefix}: ${faNumber(keys.length)} مورد`);
        return;
      }
      for (const key of keys) {
        const label = prefix ? `${prefix} › ${humanizeKey(key)}` : humanizeKey(key);
        walk(node[key], label, depth + 1);
      }
    }

    walk(value, opts.rootLabel || '', 0);
    return lines.filter(line => line.trim() !== ':' && line.trim() !== '');
  }

  function trustLine(payload) {
    const trust = payload && payload.inputTrust;
    if (!trust || typeof trust !== 'object') return null;
    const classification = TRUST_LABELS[trust.classification] || humanizeKey(String(trust.classification || 'UNKNOWN'));
    const source = TRUST_LABELS[trust.source] || humanizeKey(String(trust.source || 'UNKNOWN'));
    const binding = trust.canonicalBinding === true
      ? 'دارای اتصال به منبع معتبر'
      : 'بدون اتصال به منبع معتبر';
    return `اعتبار داده: ${classification} — ${source} (${binding})`;
  }

  function withTrust(payload, lines) {
    const line = trustLine(payload);
    return line ? [line].concat(lines) : lines;
  }

  function summarizeExecutive(payload) {
    const lines = [];
    if (payload && payload.status) lines.push(`وضعیت: ${describeValue(payload.status)}`);
    if (payload && payload.kpis) lines.push(...buildLines(payload.kpis, { rootLabel: 'شاخص‌های کلیدی', maxDepth: 2 }));
    if (payload && payload.performance) lines.push(...buildLines(payload.performance, { rootLabel: 'عملکرد', maxDepth: 2 }));
    if (payload && payload.recommendations) {
      lines.push(...buildLines(payload.recommendations, { rootLabel: 'توصیه‌ها', maxDepth: 2 }));
    }
    return { title: 'کارگاه هوش مدیریتی', lines, technical: payload };
  }

  function summarizeDecision(payload) {
    const lines = [];
    if (payload && payload.status) lines.push(`وضعیت: ${describeValue(payload.status)}`);
    if (payload && payload.recommendation) lines.push(...buildLines(payload.recommendation, { rootLabel: 'توصیه', maxDepth: 2 }));
    if (payload && payload.weightsSource) lines.push(`منبع وزن‌ها: ${describeValue(payload.weightsSource)}`);
    if (payload && payload.consistency) lines.push(...buildLines(payload.consistency, { rootLabel: 'سازگاری', maxDepth: 2 }));
    if (payload && payload.evaluations) lines.push(...buildLines(payload.evaluations, { rootLabel: 'ارزیابی گزینه‌ها', maxDepth: 2 }));
    return { title: 'کارگاه تصمیم‌گیری', lines, technical: payload };
  }

  function summarizeResilience(payload) {
    const lines = [];
    if (payload && payload.status) lines.push(`وضعیت: ${describeValue(payload.status)}`);
    if (payload && payload.metric) lines.push(`شاخص: ${describeValue(payload.metric)}`);
    if (payload && payload.baseValue !== undefined) lines.push(`مقدار پایه: ${describeValue(payload.baseValue)}`);
    if (payload && payload.simulationCount !== undefined) lines.push(`تعداد شبیه‌سازی: ${describeValue(payload.simulationCount)}`);
    if (payload && payload.statistics) lines.push(...buildLines(payload.statistics, { rootLabel: 'آماره‌ها', maxDepth: 2 }));
    if (payload && payload.scenarios) lines.push(...buildLines(payload.scenarios, { rootLabel: 'سناریوها', maxDepth: 1 }));
    return { title: 'تحلیل تاب‌آوری', lines: withTrust(payload, lines), technical: payload };
  }

  function summarizeImpact(payload) {
    const lines = [];
    if (payload && payload.status) lines.push(`وضعیت: ${describeValue(payload.status)}`);
    if (payload && payload.impact) lines.push(...buildLines(payload.impact, { rootLabel: 'اثر', maxDepth: 2 }));
    if (payload && payload.baseline) lines.push(...buildLines(payload.baseline, { rootLabel: 'وضعیت پایه', maxDepth: 2 }));
    if (payload && payload.post) lines.push(...buildLines(payload.post, { rootLabel: 'وضعیت پس از اقدام', maxDepth: 2 }));
    return { title: 'سنجش اثر', lines: withTrust(payload, lines), technical: payload };
  }

  function summarizeImprovement(payload) {
    const lines = [];
    if (payload && payload.status) lines.push(`وضعیت: ${describeValue(payload.status)}`);
    if (payload && payload.domain) lines.push(`حوزه: ${describeValue(payload.domain)}`);
    if (payload && payload.impact) lines.push(...buildLines(payload.impact, { rootLabel: 'اثر', maxDepth: 2 }));
    if (payload && payload.improvement) lines.push(...buildLines(payload.improvement, { rootLabel: 'بهبود', maxDepth: 2 }));
    if (payload && payload.recommendations) lines.push(...buildLines(payload.recommendations, { rootLabel: 'توصیه‌ها', maxDepth: 2 }));
    return { title: 'تحلیل بهبود', lines: withTrust(payload, lines), technical: payload };
  }

  function summarizeAnalytics(summary) {
    const lines = buildLines(summary, { rootLabel: '', maxDepth: 2 });
    return { title: 'تحلیل مالی پیشرفته', lines, technical: summary };
  }

  function summarizeReport(payload) {
    const lines = [];
    if (payload && typeof payload === 'object') {
      for (const key of ['status', 'title', 'generatedAt', 'currency', 'period']) {
        if (payload[key] !== undefined) lines.push(`${humanizeKey(key)}: ${describeValue(payload[key])}`);
      }
      if (payload.summary !== undefined && typeof payload.summary === 'string') {
        lines.push(`خلاصه: ${describeValue(payload.summary)}`);
      }
      if (Array.isArray(payload.sections)) {
        lines.push(`بخش‌ها: ${faNumber(payload.sections.length)} بخش`);
        payload.sections.slice(0, 8).forEach((section, index) => {
          const label = section && (section.title || section.heading || section.name);
          lines.push(`بخش ${faNumber(index + 1)}${label ? `: ${describeValue(label)}` : ''}`);
        });
      }
      if (Array.isArray(payload.limitations) && payload.limitations.length) {
        lines.push(`محدودیت‌ها: ${payload.limitations.map(item => describeValue(item)).join('، ')}`);
      }
    }
    return { title: 'گزارش مدیریتی', lines, technical: payload };
  }

  function renderResult(container, presentation) {
    if (!container) return;
    const data = presentation || {};
    const technical = data.technical;

    if (typeof container.replaceChildren !== 'function' || typeof container.appendChild !== 'function') {
      // Non-DOM caller: never emit raw JSON into the normal surface.
      container.textContent = [data.title].concat(data.lines || []).filter(Boolean).join('\n');
      return;
    }

    container.replaceChildren();
    if (data.title) {
      const heading = container.ownerDocument.createElement('p');
      heading.className = 'result-title';
      heading.textContent = data.title;
      container.appendChild(heading);
    }
    for (const line of data.lines || []) {
      if (!line) continue;
      const paragraph = container.ownerDocument.createElement('p');
      paragraph.className = 'result-line';
      paragraph.textContent = line;
      container.appendChild(paragraph);
    }
    if (technical !== undefined) {
      const details = container.ownerDocument.createElement('details');
      details.className = 'result-evidence';
      const summary = container.ownerDocument.createElement('summary');
      summary.textContent = data.technicalLabel || 'جزئیات فنی و شواهد';
      details.appendChild(summary);
      const pre = container.ownerDocument.createElement('pre');
      pre.className = 'result-evidence-body';
      pre.textContent = JSON.stringify(technical, null, 2);
      details.appendChild(pre);
      container.appendChild(details);
    }
  }

  return {
    LABELS,
    TRUST_LABELS,
    faNumber,
    humanizeKey,
    describeValue,
    buildLines,
    trustLine,
    summarizeExecutive,
    summarizeDecision,
    summarizeResilience,
    summarizeImpact,
    summarizeImprovement,
    summarizeAnalytics,
    summarizeReport,
    renderResult
  };
});
