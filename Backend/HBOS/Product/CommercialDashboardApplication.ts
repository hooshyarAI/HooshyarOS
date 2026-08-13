import { AlertsEngine, AlertResult } from "../Engines/AlertsEngine";
import { DashboardEngine, DashboardSnapshot } from "../Engines/DashboardEngine";
import { ReportResult, ReportsEngine } from "../Engines/ReportsEngine";

export interface DashboardInput {
    title: string;
    metrics: Record<string, number>;
    sections: string[];
    alertThresholds?: Record<string, number>;
}

export interface CommercialDashboardResult {
    status: "READY" | "BLOCKED";
    dashboard: DashboardSnapshot;
    report: ReportResult;
    alerts: Record<string, AlertResult>;
}

export class CommercialDashboardApplication {
    readonly capabilityId = "product.dashboard-and-report-application";
    readonly targetEngine = "Executive Intelligence Engine";

    private readonly dashboardEngine = new DashboardEngine();
    private readonly reportsEngine = new ReportsEngine();
    private readonly alertsEngine = new AlertsEngine();

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    build(input: DashboardInput): CommercialDashboardResult {
        const dashboard = this.dashboardEngine.snapshot(input?.metrics);
        const report = this.reportsEngine.build(
            input?.title ?? "",
            input?.sections ?? [],
        );

        const thresholds = input?.alertThresholds ?? {};
        const alerts = Object.fromEntries(
            Object.entries(thresholds).map(([metric, threshold]) => [
                metric,
                this.alertsEngine.evaluate(
                    input?.metrics?.[metric] ?? Number.NaN,
                    threshold,
                ),
            ]),
        );

        const alertsReady = Object.values(alerts).every(
            alert => alert.status === "READY",
        );

        const status =
            dashboard.status === "READY" &&
            report.status === "READY" &&
            alertsReady
                ? "READY"
                : "BLOCKED";

        return { status, dashboard, report, alerts };
    }

    execute(input: DashboardInput): CommercialDashboardResult {
        return this.build(input);
    }
}
