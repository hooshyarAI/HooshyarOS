import { DecisionWorkbench } from "../Product/DecisionWorkbench";

describe("DecisionWorkbench", () => {
    it("exposes the canonical capability identity and health", () => {
        const engine = new DecisionWorkbench();
        expect(engine.name).toBe("DecisionWorkbench");
        expect(engine.health()).toBe(true);
        expect(engine.describeCapability()).toEqual({
            id: "repair-product.decision-workbench",
            capability: "repair and re-verify knot product.decision-workbench from checkpoint 4c9aeefb",
            targetEngine: "Decision Intelligence Engine"
        });
    });
});

describe("DecisionWorkbench — product.decision-workbench Expert Choice evaluation", () => {
    const baseInput = {
        tenantId: "tenant-a",
        problem: "choose expansion plan",
        alternatives: ["Alpha", "Beta"],
        criteria: [
            { name: "profit", weight: 0.6, direction: "benefit" as const },
            { name: "risk", weight: 0.4, direction: "cost" as const },
        ],
        scores: [
            [8, 4],
            [6, 3],
        ],
    };

    it("ranks alternatives with declared weights and returns explainable evidence", () => {
        const result = new DecisionWorkbench().execute(baseInput);

        expect(result.status).toBe("READY");
        expect(result.capabilityId).toBe("product.decision-workbench");
        expect(result.targetEngine).toBe("Decision Intelligence Engine");
        expect(result.method).toBe("EXPERT_CHOICE");
        expect(result.weightsSource).toBe("DECLARED");
        expect(result.consistency).toBeNull();
        expect(result.weights).toHaveLength(2);
        expect(result.weights[0]).toBeCloseTo(0.6, 6);
        expect(result.weights[1]).toBeCloseTo(0.4, 6);
        expect(result.recommendation?.alternative).toBe("Alpha");
        expect(result.recommendation?.alternativeIndex).toBe(0);
        expect(result.recommendation?.closeness).toBeCloseTo(0.6, 6);
        expect(result.recommendation?.rationale).toContain("TOPSIS closeness");
        expect(result.evaluations).toHaveLength(2);
        expect(result.evaluations.map((e) => e.rank)).toEqual([1, 2]);
        expect(result.evaluations.every((e) => Number.isFinite(e.closeness))).toBe(true);
        expect(result.assumptions.length).toBeGreaterThan(0);
        expect(result.limitations.length).toBeGreaterThan(0);
    });

    it("derives weights from an AHP pairwise matrix and reports consistency", () => {
        const result = new DecisionWorkbench().execute({
            ...baseInput,
            pairwiseMatrix: [
                [1, 3],
                [1 / 3, 1],
            ],
        });

        expect(result.status).toBe("READY");
        expect(result.weightsSource).toBe("AHP");
        expect(result.weights[0]).toBeCloseTo(0.75, 6);
        expect(result.weights[1]).toBeCloseTo(0.25, 6);
        expect(result.consistency?.consistent).toBe(true);
        expect(result.recommendation?.alternative).toBe("Alpha");
    });

    it("is deterministic for identical input", () => {
        const engine = new DecisionWorkbench();
        const first = engine.execute(baseInput);
        const second = engine.execute(baseInput);
        expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    });

    it("fails closed on missing tenant, invalid dimensions, duplicate criteria and malformed input", () => {
        const engine = new DecisionWorkbench();
        expect(engine.execute({ ...baseInput, tenantId: "  " }).status).toBe("BLOCKED");
        expect(engine.execute({ ...baseInput, alternatives: ["only-one"] }).status).toBe("BLOCKED");
        expect(engine.execute({ ...baseInput, scores: [[8, 4]] }).status).toBe("BLOCKED");
        expect(engine.execute({ ...baseInput, scores: [[8, Number.NaN], [6, 3]] }).status).toBe("BLOCKED");
        expect(engine.execute({
            ...baseInput,
            criteria: [
                { name: "profit", weight: 0.5, direction: "benefit" },
                { name: "profit", weight: 0.5, direction: "cost" },
            ],
        }).status).toBe("BLOCKED");
        expect(engine.execute({
            ...baseInput,
            criteria: [{ name: "profit", weight: 0, direction: "benefit" }],
        }).status).toBe("BLOCKED");
        expect(engine.execute({
            ...baseInput,
            criteria: [{ name: "profit", weight: 0.5, direction: "unknown" as never }],
        }).status).toBe("BLOCKED");
        const blocked = engine.execute({ ...baseInput, problem: "" });
        expect(blocked.status).toBe("BLOCKED");
        expect(blocked.recommendation).toBeNull();
        expect(blocked.evaluations).toHaveLength(0);
    });
});

