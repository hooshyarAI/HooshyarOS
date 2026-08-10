import { ReasoningEngine } from "../Engines/ReasoningEngine";

describe("ReasoningEngine", () => {
    it("has canonical identity and health", () => {
        const engine = new ReasoningEngine();
        expect(engine.name).toBe("ReasoningEngine");
        expect(engine.health()).toBe(true);
    });

    it("rejects an empty reasoning problem", () => {
        const result = new ReasoningEngine().reason(" ");
        expect(result.success).toBe(false);
        expect(result.status).toBe("invalid_problem");
    });
});
