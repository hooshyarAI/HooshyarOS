(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.HooshyarExecutiveEvaluationViewModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const number = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 });
  const metrics = {
    revenue: { label: "درآمد", directionText: "بیشتر بهتر است", ratio: false },
    profit: { label: "سود", directionText: "بیشتر بهتر است", ratio: false },
    profitMargin: { label: "حاشیه سود", directionText: "بیشتر بهتر است", ratio: true },
    debtRatio: { label: "نسبت بدهی", directionText: "کمتر بهتر است", ratio: true }
  };
  const statuses = {
    ON_TRACK: "در محدوده هدف",
    AT_RISK: "نیازمند بررسی فاصله از هدف",
    BLOCKED: "ارزیابی مسدود شد"
  };
  const actions = {
    MONITOR: "هدف تأمین شده است؛ پایش ادامه یابد. این نتیجه به‌تنهایی علت تغییرات را اثبات نمی‌کند.",
    INVESTIGATE_TARGET_SHORTFALL: "مقدار واقعی پایین‌تر از هدف است؛ علت فاصله و گزینه‌های اصلاح باید با شواهد بررسی شوند.",
    INVESTIGATE_TARGET_EXCEEDANCE: "مقدار واقعی از حد هدف بالاتر است؛ علت و گزینه‌های کاهش باید با شواهد بررسی شوند.",
    VERIFY_INPUTS: "مقدار واقعی، هدف یا قرارداد شاخص معتبر نیست؛ پیش از توصیه اجرایی داده‌ها بررسی شوند."
  };
  const signed = value => `${value > 0 ? "+" : ""}${number.format(value)}`;
  const formatValue = (name, value) => {
    if (!Number.isFinite(value)) return "—";
    return metrics[name].ratio ? `${number.format(value * 100)}٪` : number.format(value);
  };

  function buildRows(evaluation) {
    if (!evaluation || !Array.isArray(evaluation.kpis)) return [];
    return evaluation.kpis.map((kpi, index) => {
      const metric = metrics[kpi?.name];
      if (!metric) return null;
      const recommendation = evaluation.recommendations?.[index];
      const valuesValid = Number.isFinite(kpi.actual) &&
        Number.isFinite(kpi.target) && kpi.target > 0 &&
        Number.isFinite(kpi.variance) && Number.isFinite(kpi.achievementRate) &&
        (kpi.direction === "higher-is-better" || kpi.direction === "lower-is-better");
      const status = valuesValid && Object.prototype.hasOwnProperty.call(statuses, recommendation?.status)
        ? recommendation.status : "BLOCKED";
      const suggestedCode = recommendation?.actionCode;
      const actionCode = status === "BLOCKED" ? "VERIFY_INPUTS" :
        (Object.prototype.hasOwnProperty.call(actions, suggestedCode)
          ? suggestedCode
          : status === "ON_TRACK" ? "MONITOR"
            : kpi.direction === "lower-is-better" ? "INVESTIGATE_TARGET_EXCEEDANCE"
              : "INVESTIGATE_TARGET_SHORTFALL");
      const varianceText = !valuesValid
        ? "محاسبه‌نشده"
        : metric.ratio
          ? `${signed(kpi.variance * 100)} واحد درصد`
          : `${signed(kpi.variance)} (${signed((kpi.variance / Math.abs(kpi.target)) * 100)}٪ از هدف)`;

      return {
        key: kpi.name,
        label: metric.label,
        status,
        statusText: statuses[status],
        actualText: formatValue(kpi.name, kpi.actual),
        targetText: formatValue(kpi.name, kpi.target),
        varianceText,
        achievementText: valuesValid ? `${number.format(kpi.achievementRate)}٪` : "—",
        directionText: metric.directionText,
        actionText: actions[actionCode]
      };
    }).filter(Boolean);
  }

  return { buildRows };
});
