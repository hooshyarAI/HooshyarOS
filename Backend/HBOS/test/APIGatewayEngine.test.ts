import { APIGatewayEngine } from "../Engines/APIGatewayEngine";

describe("APIGatewayEngine", () => {
    it("routes a canonical request", () => {
        const engine = new APIGatewayEngine();
        expect(engine.name).toBe("APIGatewayEngine");
        expect(engine.health()).toBe(true);
        expect(engine.route("/api/health", "get")).toEqual({
            path: "/api/health",
            method: "GET",
            status: "READY"
        });
    });

    it("blocks an empty request", () => {
        const result = new APIGatewayEngine().route(" ", " ");
        expect(result.status).toBe("BLOCKED");
    });
});
