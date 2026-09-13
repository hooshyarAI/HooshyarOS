import { DecisionIntelligenceEngine } from "../Engines/DecisionIntelligenceEngine";

describe("DecisionIntelligenceEngine AHP (09-1.10)", () => {
    const engine = new DecisionIntelligenceEngine();

    test("AHP perfectly consistent 3x3 returns equal weights, CR=0", () => {
        // Perfectly consistent: a_ij = 2, a_ji = 0.5
        const r = engine.ahp({
            matrix: [
                [1, 2, 4],
                [0.5, 1, 2],
                [0.25, 0.5, 1]
            ]
        });
        expect(r.status).toBe("READY");
        expect(r.criteriaCount).toBe(3);
        // Weights should all be equal (~0.5714) for consistent pairwise
        expect(r.weights[0]).toBeCloseTo(4 / 7, 3);
        expect(r.weights[1]).toBeCloseTo(2 / 7, 3);
        expect(r.weights[2]).toBeCloseTo(1 / 7, 3);
        expect(r.lambdaMax).toBeCloseTo(3, 5);
        expect(r.consistencyIndex).toBeCloseTo(0, 5);
        expect(r.consistencyRatio).toBe(0);
        expect(r.consistent).toBe(true);
    });

    test("AHP 2x2 always consistent, weights are normalized", () => {
        const r = engine.ahp({ matrix: [[1, 3], [1 / 3, 1]] });
        expect(r.status).toBe("READY");
        expect(r.weights[0]).toBeCloseTo(0.75, 5);
        expect(r.weights[1]).toBeCloseTo(0.25, 5);
        expect(r.consistent).toBe(true);
    });

    test("AHP inconsistent matrix flagged with CR > 0.10", () => {
        // Classic inconsistent 3x3
        const r = engine.ahp({
            matrix: [
                [1, 2, 5],
                [0.5, 1, 8],
                [0.2, 0.125, 1]
            ]
        });
        expect(r.status).toBe("READY");
        expect(r.consistent).toBe(false);
        expect(r.consistencyRatio).toBeGreaterThan(0.10);
    });

    test("AHP blocks non-square matrix", () => {
        expect(engine.ahp({ matrix: [[1, 2, 3]] }).status).toBe("BLOCKED");
        expect(engine.ahp({ matrix: [[1, 2], [1, 2], [1, 2]] }).status).toBe("BLOCKED");
    });

    test("AHP blocks non-positive entries", () => {
        expect(engine.ahp({ matrix: [[1, -1], [0.5, 1]] }).status).toBe("BLOCKED");
        expect(engine.ahp({ matrix: [[1, 0], [0, 1]] }).status).toBe("BLOCKED");
    });

    test("AHP blocks empty matrix", () => {
        expect(engine.ahp({ matrix: [] }).status).toBe("BLOCKED");
    });

    test("AHP weights sum to 1", () => {
        const r = engine.ahp({
            matrix: [[1, 2, 4], [0.5, 1, 2], [0.25, 0.5, 1]]
        });
        const sum = r.weights.reduce((a, b) => a + b, 0);
        expect(sum).toBeCloseTo(1, 5);
    });
});
