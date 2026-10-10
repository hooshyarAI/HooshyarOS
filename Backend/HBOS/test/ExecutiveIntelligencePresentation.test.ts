type ExecutiveViewModel = {
  buildRows(evaluation: {
    kpis: Array<{
      name: string;
      actual: number;
      target: number;
      variance: number;
      achievementRate: number;
      direction: "higher-is-better" | "lower-is-better";
    }>;
    recommendations: Array<{ status: "ON_TRACK" | "AT_RISK" | "BLOCKED"; actionCode: string }>;
  }): Array<{
    key: string;
    status: string;
    statusText: string;
    actualText: string;
    targetText: string;
    varianceText: string;
    achievementText: string;
    directionText: string;
    actionText: string;
  }>;
};

const { buildRows } = require("../../../web/executive-evaluation-view-model.js") as ExecutiveViewModel;

describe("executive evaluation presentation contract", () => {
  it("explains a higher-is-better shortfall using observed value, target, variance, achievement and next step", () => {
    const [row] = buildRows({
      kpis: [{
        name: "revenue", actual: 80, target: 100, variance: -20,
        achievementRate: 80, direction: "higher-is-better",
      }],
      recommendations: [{ status: "AT_RISK", actionCode: "INVESTIGATE_TARGET_SHORTFALL" }],
    });

    expect(row).toMatchObject({
      key: "revenue", status: "AT_RISK",
      statusText: "نیازمند بررسی فاصله از هدف",
      actualText: "۸۰", targetText: "۱۰۰",
      directionText: "بیشتر بهتر است",
    });
    expect(row.varianceText).toContain("از هدف");
    expect(row.achievementText).toContain("٪");
    expect(row.actionText).toContain("پایین‌تر از هدف");
  });

  it("explains a favorable lower-is-better debt ratio in percentage points", () => {
    const [row] = buildRows({
      kpis: [{
        name: "debtRatio", actual: 0.35, target: 0.4, variance: -0.05,
        achievementRate: 114.2857, direction: "lower-is-better",
      }],
      recommendations: [{ status: "ON_TRACK", actionCode: "MONITOR" }],
    });

    expect(row).toMatchObject({
      key: "debtRatio", status: "ON_TRACK",
      actualText: "۳۵٪", targetText: "۴۰٪", directionText: "کمتر بهتر است",
    });
    expect(row.varianceText).toContain("واحد درصد");
    expect(row.achievementText).toContain("٪");
    expect(row.actionText).toContain("پایش ادامه یابد");
  });

  it("blocks invalid metrics rather than presenting an on-track recommendation", () => {
    const [row] = buildRows({
      kpis: [{
        name: "profit", actual: Number.NaN, target: 100, variance: Number.NaN,
        achievementRate: Number.NaN, direction: "higher-is-better",
      }],
      recommendations: [{ status: "ON_TRACK", actionCode: "MONITOR" }],
    });

    expect(row.status).toBe("BLOCKED");
    expect(row.statusText).toBe("ارزیابی مسدود شد");
    expect(row.actionText).toContain("پیش از توصیه اجرایی");
    expect(row.actualText).toBe("—");
    expect(row.varianceText).toBe("محاسبه‌نشده");
  });
});
