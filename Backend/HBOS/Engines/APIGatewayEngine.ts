import { Engine } from "../Core/Engine";

export class APIGatewayEngine implements Engine {
    name = "APIGatewayEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return {
            id: "platform.api-gateway",
            capability: "implement the Phase 2 API Gateway capability",
            targetEngine: "API Gateway Engine"
        };
    }
}
