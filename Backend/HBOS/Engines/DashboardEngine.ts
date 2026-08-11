import { Engine } from "../Core/Engine";

export class DashboardEngine implements Engine {
    name = "DashboardEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return {
            id: "platform.dashboard",
            capability: "implement Dashboard capability",
            targetEngine: "Dashboard Engine"
        };
    }
}
