import { Engine } from "../Core/Engine";

export class AlertsEngine implements Engine {
    name = "AlertsEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return {
            id: "platform.alerts",
            capability: "implement Alerts capability",
            targetEngine: "Alerts Engine"
        };
    }
}
