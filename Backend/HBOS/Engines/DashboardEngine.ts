import { Engine } from "../Core/Engine";

export type DashboardMetrics = Record<string, number>;
export interface DashboardSnapshot { metrics: DashboardMetrics; total: number; status: "READY" | "BLOCKED"; }

export class DashboardEngine implements Engine {
    name = "DashboardEngine";
    initialize(): void {}
    health(): boolean { return true; }
    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return { id: "platform.dashboard", capability: "implement Dashboard capability", targetEngine: "Dashboard Engine" };
    }
    snapshot(metrics: DashboardMetrics): DashboardSnapshot {
        if (!metrics || Object.values(metrics).some(value => !Number.isFinite(value))) {
            return { metrics: {}, total: 0, status: "BLOCKED" };
        }
        return { metrics, total: Object.values(metrics).reduce((sum, value) => sum + value, 0), status: "READY" };
    }
}
