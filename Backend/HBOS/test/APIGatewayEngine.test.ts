import { APIGatewayEngine } from "../Engines/APIGatewayEngine";

describe("APIGatewayEngine", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new APIGatewayEngine();
        expect(engine.name).toBe("APIGatewayEngine");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "platform.api-gateway",
            capability: "implement the Phase 2 API Gateway capability",
            targetEngine: "API Gateway Engine"
        });
    });
});
