import { GovernanceEngine } from "../Engines/GovernanceEngine";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";

describe("GovernanceEngine (frozen Engine contract)", () => {
    test("initialize() is void and does not throw", () => {
        const engine = new GovernanceEngine();
        expect(engine.initialize()).toBeUndefined();
    });

    test("name and health reflect a live engine", () => {
        const engine = new GovernanceEngine();
        engine.initialize();
        expect(engine.name).toBe("GovernanceEngine");
        expect(engine.health()).toBe(true);
    });

    test("after initialize the engine performs a real governance evaluation", () => {
        const engine = new GovernanceEngine();
        engine.initialize();
        engine.clearPolicies();

        const result = engine.evaluate({
            action: "CREATE_RESOURCE",
            securityContext: SecurityContext.forHumanUser(
                Principal.humanUser("owner-1", "tenant-1"),
                [Authorization.WRITE]
            ),
        });

        expect(result.status).toBe("ALLOWED");
        expect(result.appliedPolicies).toEqual([]);
        expect(result.traceId).toBeDefined();
        expect(result.confidence).toEqual({ source: "unavailable" });
    });
});
