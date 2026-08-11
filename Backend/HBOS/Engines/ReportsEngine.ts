import { Engine } from "../Core/Engine";

export class ReportsEngine implements Engine {
    name = "ReportsEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return {
            id: "platform.reports",
            capability: "implement Reports capability",
            targetEngine: "Reports Engine"
        };
    }
}
