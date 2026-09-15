import { ResilienceAnalyticsService } from "../Product/ResilienceAnalyticsService";

describe("ResilienceAnalyticsService", () => {
    const service = new ResilienceAnalyticsService();
    const TENANT = "tenant:resilience-test";

    test("stressTest returns deterministic bounds when no residuals provided", () => {
        const result = service.stressTest({
            tenantId: TENANT,
            metric: "revenue",
            baseValue: 1000,
            scenarios: [
                { name: "recession", description: "Economic recession scenario", shockPercent: -30, appliedAt: 1 },
                { name: "boom", description: "Economic boom scenario", shockPercent: 20, appliedAt: 1 }
            ]
        });

        expect(result.status).toBe("READY");
        expect(result.mode).toBe("deterministic_bounds");
        expect(result.baseValue).toBe(1000);
        expect(result.scenarioBounds).toHaveLength(2);
        expect(result.scenarioBounds[0].bound).toBeCloseTo(700, 5);
        expect(result.scenarioBounds[1].bound).toBeCloseTo(1200, 5);
        expect(result.provenance.tenant).toBe(TENANT);
    });

    test("stressTest returns Monte Carlo results when residuals provided", () => {
        const residuals = Array.from({ length: 100 }, (_, i) => ({
            residual: i % 2 === 0 ? 1 : -1
        }));

        const result = service.stressTest({
            tenantId: TENANT,
            metric: "profit",
            baseValue: 500,
            scenarios: [
                { name: "stress", description: "Stress scenario", shockPercent: -20, appliedAt: 1 }
            ],
            simulationCount: 200,
            seed: 123,
            residuals
        });

        expect(result.status).toBe("READY");
        expect(result.mode).toBe("monte_carlo");
        expect(result.baseStatistics).toBeDefined();
        expect(result.baseStatistics!.mean).toBeCloseTo(500, 0);
        expect(result.scenarioBounds).toHaveLength(1);
        expect(result.provenance.tenant).toBe(TENANT);
    });

    test("stressTest blocks invalid input", () => {
        expect(service.stressTest({
            tenantId: "",
            metric: "revenue",
            baseValue: 1000,
            scenarios: []
        }).status).toBe("BLOCKED");

        expect(service.stressTest({
            tenantId: TENANT,
            metric: "",
            baseValue: 1000,
            scenarios: []
        }).status).toBe("BLOCKED");

        expect(service.stressTest({
            tenantId: TENANT,
            metric: "revenue",
            baseValue: NaN,
            scenarios: []
        }).status).toBe("BLOCKED");
    });

    test("scenarioAnalysis delegates to stressTest with zero iterations", () => {
        const result = service.scenarioAnalysis(TENANT, "cash", 2000, [
            { name: "outflow", description: "Cash outflow scenario", shockPercent: -15, appliedAt: 1 }
        ]);

        expect(result.status).toBe("READY");
        expect(result.mode).toBe("deterministic_bounds");
        expect(result.scenarioBounds[0].bound).toBeCloseTo(1700, 5);
    });

    test("sensitivityAnalysis computes shocked values and elasticities", () => {
        const result = service.sensitivityAnalysis(TENANT, "margin", 1000, [-20, 0, 20]);

        expect((result as any).status).not.toBe("BLOCKED");
        expect((result as any).shockedValues).toHaveLength(3);
        expect((result as any).elasticities).toHaveLength(3);
        expect((result as any).baseValue).toBe(1000);
    });

    test("sensitivityAnalysis blocks empty shock range", () => {
        const result = service.sensitivityAnalysis(TENANT, "margin", 1000, []);

        expect((result as any).status).toBe("BLOCKED");
        expect((result as any).tenantId).toBe(TENANT);
    });

    test("optimize finds optimal solution for simple objective", () => {
        const result = service.optimize({
            tenantId: TENANT,
            objective: "maximize_profit",
            variableNames: ["units"],
            initialGuess: [5],
            bounds: [{ variable: "units", lower: 0, upper: 10 }]
        });

        expect(result.status).toBe("READY");
        expect(result.solution.units).toBeCloseTo(10, 1);
        expect(result.provenance.tenant).toBe(TENANT);
    });

    test("optimize blocks invalid input", () => {
        expect(service.optimize({
            tenantId: "",
            objective: "maximize_profit",
            variableNames: ["x"],
            initialGuess: [1],
            bounds: [{ variable: "x", lower: 0, upper: 10 }]
        }).status).toBe("BLOCKED");

        expect(service.optimize({
            tenantId: TENANT,
            objective: "maximize_profit",
            variableNames: ["x", "y"],
            initialGuess: [1],
            bounds: [{ variable: "x", lower: 0, upper: 10 }]
        }).status).toBe("BLOCKED");
    });

    test("optimize blocks infeasible initial guess", () => {
        const result = service.optimize({
            tenantId: TENANT,
            objective: "maximize_profit",
            variableNames: ["x"],
            initialGuess: [15],
            bounds: [{ variable: "x", lower: 0, upper: 10 }]
        });

        expect(result.status).toBe("BLOCKED");
    });

    test("tenant isolation is preserved across calls", () => {
        const tenantA = "tenant:alpha";
        const tenantB = "tenant:beta";

        const resultA = service.scenarioAnalysis(tenantA, "revenue", 1000, [
            { name: "shock", description: "Shock scenario", shockPercent: -10, appliedAt: 1 }
        ]);
        const resultB = service.scenarioAnalysis(tenantB, "revenue", 2000, [
            { name: "shock", description: "Shock scenario", shockPercent: -10, appliedAt: 1 }
        ]);

        expect(resultA.provenance.tenant).toBe(tenantA);
        expect(resultB.provenance.tenant).toBe(tenantB);
        expect(resultA.scenarioBounds[0].bound).toBeCloseTo(900, 5);
        expect(resultB.scenarioBounds[0].bound).toBeCloseTo(1800, 5);
    });
});
