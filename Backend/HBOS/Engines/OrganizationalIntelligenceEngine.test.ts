import { OrganizationalIntelligenceEngine } from "./OrganizationalIntelligenceEngine";

describe("OrganizationalIntelligenceEngine Behavior Tests", () => {
    let engine: OrganizationalIntelligenceEngine;

    beforeEach(() => {
        engine = new OrganizationalIntelligenceEngine();
    });

    describe("assess", () => {
        it("returns organizational insight with default scope", () => {
            const insight = engine.assess();
            expect(insight.scope).toBe("organization");
            expect(insight.status).toBe("READY");
            expect(insight.projectCount).toBe(0);
            expect(insight.healthy).toBe(true);
        });

        it("accepts custom scope parameter", () => {
            const insight = engine.assess("department");
            expect(insight.scope).toBe("department");
        });

        it("returns healthy status based on health check", () => {
            const insight = engine.assess();
            expect(insight.healthy).toBe(true);
        });

        it("returns project count from underlying system", () => {
            const insight = engine.assess();
            expect(typeof insight.projectCount).toBe("number");
            expect(insight.projectCount).toBeGreaterThanOrEqual(0);
        });
    });
});