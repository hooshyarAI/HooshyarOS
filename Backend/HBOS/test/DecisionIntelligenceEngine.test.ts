import { DecisionIntelligenceEngine } from "../Engines/DecisionIntelligenceEngine";


describe("DecisionIntelligenceEngine",()=>{

test("engine should initialize",()=>{

const engine=new DecisionIntelligenceEngine();

expect(
engine.initialize().status
)
.toBe("READY");

});

});


describe("DecisionIntelligenceEngine method composition", () => {
    const engine = new DecisionIntelligenceEngine();

    test("executes supplied decision methods in a deterministic bundle", () => {
        const result = engine.executeAvailableMethods({
            ahp: { matrix: [[1, 2], [0.5, 1]] },
            topsis: {
                matrix: [[1, 2], [2, 1]],
                weights: [1, 1],
                criteria: ["benefit", "cost"]
            },
            decisionTree: {
                name: "investment",
                children: [
                    { name: "success", probability: 0.6, value: 100 },
                    { name: "failure", probability: 0.4, value: 0 }
                ]
            }
        });

        expect(result.status).toBe("READY");
        expect(result.executedMethods).toEqual(["ahp", "topsis", "decisionTree"]);
        expect(result.blockedMethods).toEqual([]);
        expect(result.results.map(item => item.status)).toEqual(["READY", "READY", "READY"]);
        const treeResult = result.results[2].result;
        expect(treeResult.method).toBe("decisionTree");
        if (treeResult.method === "decisionTree") {
            expect(treeResult.expectedValue).toBeCloseTo(60, 8);
        }
    });

    test("preserves successful results when one supplied method is blocked", () => {
        const result = engine.executeAvailableMethods({
            ahp: { matrix: [[1, 0], [0, 1]] },
            topsis: {
                matrix: [[1, 2], [2, 1]],
                weights: [1, 1],
                criteria: ["benefit", "cost"]
            }
        });

        expect(result.status).toBe("PARTIAL");
        expect(result.executedMethods).toEqual(["ahp", "topsis"]);
        expect(result.blockedMethods).toEqual(["ahp"]);
        expect(result.results.map(item => item.status)).toEqual(["BLOCKED", "READY"]);
    });

    test("fails closed when no method input is supplied", () => {
        expect(engine.executeAvailableMethods({}).status).toBe("BLOCKED");
    });
});
