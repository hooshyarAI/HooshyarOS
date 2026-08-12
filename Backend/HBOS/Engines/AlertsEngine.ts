import { Engine } from "../Core/Engine";

export interface AlertResult { metric: number; threshold: number; triggered: boolean; status: "READY" | "BLOCKED"; }

export class AlertsEngine implements Engine {
    name = "AlertsEngine";
    initialize(): void {}
    health(): boolean { return true; }
    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return { id: "platform.alerts", capability: "implement Alerts capability", targetEngine: "Alerts Engine" };
    }
    evaluate(metric: number, threshold: number): AlertResult {
        if (!Number.isFinite(metric) || !Number.isFinite(threshold)) {
            return { metric: 0, threshold: 0, triggered: false, status: "BLOCKED" };
        }
        return { metric, threshold, triggered: metric >= threshold, status: "READY" };
    }
}
