import { OrganizationalIntelligenceEngine } from "../Engines/OrganizationalIntelligenceEngine";

describe("OrganizationalIntelligenceEngine", () => {
    it("owns the canonical organizational intelligence boundary", () => {
        const engine = new OrganizationalIntelligenceEngine();
        expect(engine.name).toBe("OrganizationalIntelligenceEngine");
        expect(engine.health()).toBe(true);
        expect(engine.assess().status).toBe("READY");
    });
});
