import { DecisionIntelligenceEngine } from "../Engines/DecisionIntelligenceEngine";

describe("DecisionIntelligenceEngine TOPSIS (09-1.11)", () => {
    const engine = new DecisionIntelligenceEngine();

    test("TOPSIS: simple 2-alternative 2-criteria ranking", () => {
        // A1: (8, 7), A2: (5, 9); higher is better on both criteria, equal weights
        const r = engine.topsis({
            matrix: [[8, 7], [5, 9]],
            weights: [1, 1],
            criteria: ["benefit", "benefit"]
        });
        expect(r.status).toBe("READY");
        expect(r.alternativeCount).toBe(2);
        expect(r.criteriaCount).toBe(2);
        // A1 has higher closeness because the gap in criterion 1 (8 vs 5) is bigger than the gap in criterion 2 (9 vs 7) relative to their column norms
        expect(r.bestIndex).toBe(0);
        // A1 + A2 scores sum should be (1 - 1) = 0 with weighted formulation? Actually each independent.
        for (const s of r.scores) expect(s).toBeGreaterThanOrEqual(0);
    });

    test("TOPSIS: with cost criterion, lower cost = better", () => {
        // A1: cost=8, A2: cost=5 (lower is better)
        const r = engine.topsis({
            matrix: [[10, 8], [10, 5]],
            weights: [1, 1],
            criteria: ["benefit", "cost"]
        });
        expect(r.status).toBe("READY");
        // A2 has lower cost -> should be best (lower is better on cost criterion)
        expect(r.bestIndex).toBe(1);
    });

    test("TOPSIS blocks inconsistent dimensions", () => {
        expect(engine.topsis({ matrix: [[1, 2], [3]], weights: [1, 1], criteria: ["benefit", "benefit"] }).status).toBe("BLOCKED");
        expect(engine.topsis({ matrix: [[1, 2], [3, 4]], weights: [1], criteria: ["benefit"] }).status).toBe("BLOCKED");
        expect(engine.topsis({ matrix: [[1, 2], [3, 4]], weights: [1, 1], criteria: ["benefit"] }).status).toBe("BLOCKED");
    });

    test("TOPSIS blocks NaN matrix entries", () => {
        expect(engine.topsis({ matrix: [[Number.NaN, 1]], weights: [1, 1], criteria: ["benefit", "benefit"] }).status).toBe("BLOCKED");
    });

    test("TOPSIS blocks negative weights", () => {
        expect(engine.topsis({ matrix: [[1, 2], [3, 4]], weights: [-1, 1], criteria: ["benefit", "benefit"] }).status).toBe("BLOCKED");
    });

    test("TOPSIS blocks zero weight sum", () => {
        expect(engine.topsis({ matrix: [[1, 2], [3, 4]], weights: [0, 0], criteria: ["benefit", "benefit"] }).status).toBe("BLOCKED");
    });

    test("TOPSIS scores in [0, 1]", () => {
        const r = engine.topsis({
            matrix: [[250, 16, 12], [200, 16, 8], [300, 32, 16], [275, 32, 8]],
            weights: [0.25, 0.25, 0.5],
            criteria: ["benefit", "benefit", "benefit"]
        });
        expect(r.status).toBe("READY");
        for (const s of r.scores) {
            expect(s).toBeGreaterThanOrEqual(0);
            expect(s).toBeLessThanOrEqual(1);
        }
    });
});

describe("DecisionIntelligenceEngine decision tree EMV (09-1.12)", () => {
    const engine = new DecisionIntelligenceEngine();

    test("EMV known: invest in project with 0.5 prob of 200, 0.5 prob of 0 -> 100", () => {
        const r = engine.decisionTree({
            name: "root",
            children: [
                { name: "success", probability: 0.5, value: 200 },
                { name: "fail", probability: 0.5, value: 0 }
            ]
        });
        expect(r.status).toBe("READY");
        expect(r.expectedValue).toBe(100);
    });

    test("EMV nested known", () => {
        // Choose market A (0.6 -> 200 then upgrade 0.5 -> 100 vs no upgrade 0) and market B (0.4 -> 50)
        // EV(A) = 0.5 * 100 + 0.5 * 0 = 50
        // EV(B) = 50
        // EV(root) = 0.6 * 200 + 0.4 * 50 = 120 + 20 = 140 (where EV(upgrade branch) handled at parent)
        // Actually root has 2 children, each with explicit probability; their values include nested decisions.
        // Let's construct: root -> {A: 0.6 [upgrade-or-not child] -> upgrade(value 250), not(value 100); B: 0.4, value 50}
        // For child A (no explicit prob), its EMV is its children's EMV (0.5*250 + 0.5*100 = 175)
        // So EV(A) = 175, EV(B) = 50
        // EV(root) = 0.6 * 175 + 0.4 * 50 = 105 + 20 = 125
        const r = engine.decisionTree({
            name: "root",
            children: [
                { name: "A", probability: 0.6, children: [
                    { name: "upgrade", probability: 0.5, value: 250 },
                    { name: "noUpgrade", probability: 0.5, value: 100 }
                ] },
                { name: "B", probability: 0.4, value: 50 }
            ]
        });
        expect(r.status).toBe("READY");
        expect(r.expectedValue).toBe(125);
    });

    test("EMV blocks negative probability", () => {
        const r = engine.decisionTree({
            name: "root",
            children: [
                { name: "x", probability: -0.5, value: 100 }
            ]
        });
        expect(r.status).toBe("BLOCKED");
    });

    test("EMV blocks NaN value", () => {
        const r = engine.decisionTree({ name: "leaf", value: Number.NaN });
        expect(r.status).toBe("BLOCKED");
    });

    test("EMV with simple leaf", () => {
        const r = engine.decisionTree({ name: "leaf", value: 42 });
        expect(r.status).toBe("READY");
        expect(r.expectedValue).toBe(42);
    });

    test("no NaN/Infinity leaks", () => {
        const r = engine.decisionTree({
            name: "root",
            children: [
                { name: "a", probability: 0.5, value: 100 },
                { name: "b", probability: 0.5, value: -50 }
            ]
        });
        expect(r.status).toBe("READY");
        expect(Number.isFinite(r.expectedValue)).toBe(true);
        expect(r.expectedValue).toBe(25);
    });
});
