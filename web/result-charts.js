(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HooshyarResultCharts = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const MISSING_DATA_TEXT = 'اطلاعات کافی نیست';
  const EMPTY_STATE_TEXT = 'داده‌ای برای نمایش روند وجود ندارد';

  function faNumber(value, maximumFractionDigits = 0) {
    const n = Number(value);
    if (!Number.isFinite(n)) return MISSING_DATA_TEXT;
    try {
      return n.toLocaleString('fa-IR', { 
        minimumFractionDigits: maximumFractionDigits,
        maximumFractionDigits: maximumFractionDigits,
        useGrouping: true
      });
    } catch {
      // Fallback for environments that don't support fa-IR
      return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  }

  function formatPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return MISSING_DATA_TEXT;
    return faNumber(n * 100, 2) + '٪';
  }

  function renderCharts(container, insight) {
    if (!container) return;
    container.innerHTML = '';
    if (!insight) {
      container.textContent = MISSING_DATA_TEXT;
      return;
    }

    const doc = container.ownerDocument;
    const wrapper = doc.createElement('div');
    wrapper.className = 'charts-container';
    wrapper.setAttribute('aria-label', 'چارت‌های مالی');
    container.appendChild(wrapper);

    // Trend Chart
    const trendSection = doc.createElement('div');
    trendSection.className = 'chart-section';
    wrapper.appendChild(trendSection);

    const trendTitle = doc.createElement('h4');
    trendTitle.textContent = 'روند مالی';
    trendSection.appendChild(trendTitle);

    const trendSvg = doc.createElementNS(SVG_NS, 'svg');
    trendSvg.setAttribute('role', 'img');
    trendSvg.setAttribute('aria-label', 'چارت روند مالی');
    trendSvg.setAttribute('tabindex', '0');
    trendSvg.setAttribute('width', '200');
    trendSvg.setAttribute('height', '150');
    const trendSvgTitle = doc.createElementNS(SVG_NS, 'title');
    trendSvgTitle.textContent = 'روند مالی';
    const trendSvgDesc = doc.createElementNS(SVG_NS, 'desc');
    trendSvgDesc.textContent = 'نمایش روند درآمد، سود ناخالص، سود عملیاتی و سود خالص';
    trendSvg.appendChild(trendSvgTitle);
    trendSvg.appendChild(trendSvgDesc);
    const trendRect = doc.createElementNS(SVG_NS, 'rect');
    trendRect.setAttribute('x', '10');
    trendRect.setAttribute('y', '10');
    trendRect.setAttribute('width', '180');
    trendRect.setAttribute('height', '130');
    trendRect.setAttribute('fill', '#f0f0f0');
    trendSvg.appendChild(trendRect);
    const trendText = doc.createElementNS(SVG_NS, 'text');
    trendText.setAttribute('x', '20');
    trendText.setAttribute('y', '40');
    trendText.setAttribute('font-family', 'Vazir');
    trendText.setAttribute('font-size', '12');
    trendText.textContent = 'روند مالی';
    trendSvg.appendChild(trendText);
    trendSection.appendChild(trendSvg);

     const trendDl = doc.createElement('dl');
     trendDl.className = 'chart-trend';
     const trendLineLabels = {
       revenue: 'درآمد',
       grossProfit: 'سود ناخالص',
       operatingIncome: 'سود عملیاتی',
       netIncome: 'سود خالص'
     };
     if (insight.comparative && insight.comparative.length > 0) {
       insight.comparative.forEach(entry => {
         const dt = doc.createElement('dt');
         dt.textContent = trendLineLabels[entry.line] || entry.line;
         const dd = doc.createElement('dd');
         dd.textContent = faNumber(entry.current) + ' ' + faNumber(entry.prior);
         trendDl.appendChild(dt);
         trendDl.appendChild(dd);
       });
     } else {
       const dt = doc.createElement('dt');
       dt.textContent = 'روند';
       const dd = doc.createElement('dd');
       dd.textContent = EMPTY_STATE_TEXT;
       trendDl.appendChild(dt);
       trendDl.appendChild(dd);
     }
    trendSection.appendChild(trendDl);

    // Profitability Chart
    const profitSection = doc.createElement('div');
    profitSection.className = 'chart-section';
    wrapper.appendChild(profitSection);

    const profitTitle = doc.createElement('h4');
    profitTitle.textContent = 'سودآوری';
    profitSection.appendChild(profitTitle);

    const profitSvg = doc.createElementNS(SVG_NS, 'svg');
    profitSvg.setAttribute('role', 'img');
    profitSvg.setAttribute('aria-label', 'چارت سودآوری');
    profitSvg.setAttribute('tabindex', '0');
    profitSvg.setAttribute('width', '200');
    profitSvg.setAttribute('height', '150');
    const profitSvgTitle = doc.createElementNS(SVG_NS, 'title');
    profitSvgTitle.textContent = 'سودآوری';
    const profitSvgDesc = doc.createElementNS(SVG_NS, 'desc');
    profitSvgDesc.textContent = 'نمایش نسبت‌های سودآوری';
    profitSvg.appendChild(profitSvgTitle);
    profitSvg.appendChild(profitSvgDesc);
    const profitRect = doc.createElementNS(SVG_NS, 'rect');
    profitRect.setAttribute('x', '10');
    profitRect.setAttribute('y', '10');
    profitRect.setAttribute('width', '180');
    profitRect.setAttribute('height', '130');
    profitRect.setAttribute('fill', '#f0f0f0');
    profitSvg.appendChild(profitRect);
    const profitText = doc.createElementNS(SVG_NS, 'text');
    profitText.setAttribute('x', '20');
    profitText.setAttribute('y', '40');
    profitText.setAttribute('font-family', 'Vazir');
    profitText.setAttribute('font-size', '12');
    profitText.textContent = 'سودآوری';
    profitSvg.appendChild(profitText);
    profitSection.appendChild(profitSvg);

      const profitDl = doc.createElement('dl');
      profitDl.className = 'chart-profitability';
     // Add methodology row
     if (insight.profitabilityMethodology) {
       const methodologyMap = {
         'AVERAGE_BALANCE': 'میانگین مانده\u200cها',
         'ENDING_BALANCE_FALLBACK': 'مبنای مانده پایان دوره'
       };
       const methodologyLabel = methodologyMap[insight.profitabilityMethodology] || insight.profitabilityMethodology;
       const dtMethod = doc.createElement('dt');
       dtMethod.textContent = 'روش محاسبه';
       const ddMethod = doc.createElement('dd');
       ddMethod.textContent = methodologyLabel;
       profitDl.appendChild(dtMethod);
       profitDl.appendChild(ddMethod);
     }
     if (insight.ratios) {
        const ratiosToShow = [
          { key: 'roa', label: 'بازده دارایی' },
          { key: 'roe', label: 'بازده حقوق صاحبان سهام' },
          { key: 'netMargin', label: 'حاشیه سود خالص' },
          { key: 'grossMargin', label: 'حاشیه سود ناخالص' }
        ];
       ratiosToShow.forEach(({key, label}) => {
         const value = insight.ratios[key];
         if (value !== null && value !== undefined) {
           const dt = doc.createElement('dt');
           dt.textContent = label;
           const dd = doc.createElement('dd');
           dd.textContent = formatPercent(value);
           profitDl.appendChild(dt);
           profitDl.appendChild(dd);
         } else {
           const dt = doc.createElement('dt');
           dt.textContent = label;
           const dd = doc.createElement('dd');
           dd.textContent = MISSING_DATA_TEXT;
           profitDl.appendChild(dt);
           profitDl.appendChild(dd);
         }
       });
     } else {
       const dt = doc.createElement('dt');
       dt.textContent = 'سودآوری';
       const dd = doc.createElement('dd');
       dd.textContent = MISSING_DATA_TEXT;
       profitDl.appendChild(dt);
       profitDl.appendChild(dd);
     }
    profitSection.appendChild(profitDl);

    // Working Capital Chart
    const wcSection = doc.createElement('div');
    wcSection.className = 'chart-section';
    wrapper.appendChild(wcSection);

    const wcTitle = doc.createElement('h4');
    wcTitle.textContent = 'سرمایه کاری';
    wcSection.appendChild(wcTitle);

    const wcSvg = doc.createElementNS(SVG_NS, 'svg');
    wcSvg.setAttribute('role', 'img');
    wcSvg.setAttribute('aria-label', 'چارت سرمایه کاری');
    wcSvg.setAttribute('tabindex', '0');
    wcSvg.setAttribute('width', '200');
    wcSvg.setAttribute('height', '150');
    const wcSvgTitle = doc.createElementNS(SVG_NS, 'title');
    wcSvgTitle.textContent = 'سرمایه کاری';
    const wcSvgDesc = doc.createElementNS(SVG_NS, 'desc');
     wcSvgDesc.textContent = 'نمایش معیارهای سرمایه کاری';
    wcSvg.appendChild(wcSvgTitle);
    wcSvg.appendChild(wcSvgDesc);
    const wcRect = doc.createElementNS(SVG_NS, 'rect');
    wcRect.setAttribute('x', '10');
    wcSvg.setAttribute('y', '10');
    wcRect.setAttribute('width', '180');
    wcRect.setAttribute('height', '130');
    wcRect.setAttribute('fill', '#f0f0f0');
    wcSvg.appendChild(wcRect);
    const wcText = doc.createElementNS(SVG_NS, 'text');
    wcText.setAttribute('x', '20');
    wcText.setAttribute('y', '40');
    wcText.setAttribute('font-family', 'Vazir');
    wcText.setAttribute('font-size', '12');
    wcText.textContent = 'سرمایه کاری';
    wcSvg.appendChild(wcText);
    wcSection.appendChild(wcSvg);

      const wcDl = doc.createElement('dl');
      wcDl.className = 'chart-working-capital';
     if (insight.workingCapital) {
        const wcItems = [
          { key: 'dso', label: 'روزهای وصول مطالبات' },
          { key: 'dio', label: 'روزهای نگهداری موجودی' },
          { key: 'dpo', label: 'روزهای پرداخت به تأمین‌کننده' },
          { key: 'cashConversionCycle', label: 'چرخه سرمایه\u200c در گردش' }
        ];
       wcItems.forEach(({key, label}) => {
         const value = insight.workingCapital[key];
         const dt = doc.createElement('dt');
         dt.textContent = label;
         const dd = doc.createElement('dd');
         if (value !== null && value !== undefined) {
           dd.textContent = faNumber(value) + ' روز';
         } else {
           dd.textContent = MISSING_DATA_TEXT;
         }
         wcDl.appendChild(dt);
         wcDl.appendChild(dd);
       });
     } else {
       const dt = doc.createElement('dt');
       dt.textContent = 'سرمایه کاری';
       const dd = doc.createElement('dd');
       dd.textContent = MISSING_DATA_TEXT;
       wcDl.appendChild(dt);
       wcDl.appendChild(dd);
     }
     wcSection.appendChild(wcDl);
  }

  return {
    SVG_NS: SVG_NS,
    MISSING_DATA_TEXT: MISSING_DATA_TEXT,
    EMPTY_STATE_TEXT: EMPTY_STATE_TEXT,
    renderCharts: renderCharts
  };
});