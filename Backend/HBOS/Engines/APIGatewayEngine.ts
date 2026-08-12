import { Engine } from "../Core/Engine";

export interface ApiRouteResult {
    path: string;
    method: string;
    status: "READY" | "BLOCKED";
}

export class APIGatewayEngine implements Engine {
    name = "APIGatewayEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    route(path: string, method = "GET"): ApiRouteResult {
        const normalizedPath = path?.trim() ?? "";
        const normalizedMethod = method?.trim().toUpperCase() ?? "";
        if (!normalizedPath || !normalizedMethod) {
            return { path: normalizedPath, method: normalizedMethod, status: "BLOCKED" };
        }
        return { path: normalizedPath, method: normalizedMethod, status: "READY" };
    }

    describeCapability(): { id: string; capability: string; targetEngine: string } {
        return {
            id: "platform.api-gateway",
            capability: "implement the Phase 2 API Gateway capability",
            targetEngine: "API Gateway Engine"
        };
    }
}
