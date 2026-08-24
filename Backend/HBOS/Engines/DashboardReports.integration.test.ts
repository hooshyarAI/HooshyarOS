import { DashboardEngine } from "./DashboardEngine";
import { ReportsEngine } from "./ReportsEngine";

describe("Dashboard and reports integration", () => {
  it("turns a validated dashboard snapshot into a usable report", () => {
    const dashboard = new DashboardEngine();
    const reports = new ReportsEngine();
    const snapshot = dashboard.snapshot({ revenue: 1200, profit: 300, risk: 0.2 });
    const report = reports.build("Executive financial snapshot", [
      `Revenue: ${snapshot.metrics.revenue}`,
      `Profit: ${snapshot.metrics.profit}`,
      `Risk: ${snapshot.metrics.risk}`,
      `Total: ${snapshot.total}`,
    ]);

    expect(snapshot.status).toBe("READY");
    expect(report.status).toBe("READY");
    expect(report.sections).toHaveLength(4);
    expect(report.sections[3]).toBe("Total: 1500.2");
  });
});
