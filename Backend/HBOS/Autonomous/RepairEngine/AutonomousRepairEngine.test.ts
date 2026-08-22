import { AutonomousRepairEngine } from "./AutonomousRepairEngine";
import { AutonomousRepairIntegrator } from "../Integration/AutonomousRepairIntegrator";

describe("AutonomousRepairEngine", () => {
    test("creates a governed repair plan without claiming mutation", () => {
        const engine = new AutonomousRepairEngine();
        const plan = engine.createPlan("AUTONOMOUS_VERIFY_FAILED", "Backend/HBOS/TestFailure.ts", "product.example");
        expect(plan.capabilityId).toBe("product.example");
        expect(plan.governingPrinciples).toContain("PLATFORM_FIRST");
        expect(engine.execute(plan).repaired).toBe(false);
    });
});

describe("AutonomousRepairIntegrator", () => {
    test("fails closed when repair authorization is absent", async () => {
        const integrator = new AutonomousRepairIntegrator();
        const result = await integrator.repairFailure("VERIFY_FAILED", "Backend/HBOS/TestFailure.ts");
        expect(result.repaired).toBe(false);
        expect(result.reason).toBe("REPAIR_AUTHORIZATION_REQUIRED");
        expect(result.aprvl.verified).toBe(false);
    });

    test("requires an explicit authorized repair action", async () => {
        const aprvl = { execute: async () => ({ authorized: true, verified: true, summary: "VERIFIED" }) };
        const capability = { execute: async () => ({ action: "replace-file", relativePath: "x.ts", changed: true, verified: true, digest: "digest" }) };
        const integrator = new AutonomousRepairIntegrator(process.cwd(), aprvl as any, capability as any);
        const result = await integrator.repairFailure(
            "VERIFY_FAILED",
            "Backend/HBOS/TestFailure.ts",
            { authorization: { authorized: true, authorizationToken: "token" } },
        );
        expect(result.repaired).toBe(false);
        expect(result.reason).toBe("REPAIR_ACTION_REQUIRED");
    });

    test("passes independent APRVL evidence into the canonical controlled-repair boundary", async () => {
        const aprvl = { execute: async () => ({ authorized: true, verified: true, summary: "VERIFIED" }) };
        const capability = { execute: async (action: any) => ({ action: action.action, relativePath: action.relativePath, changed: true, verified: true, digest: "digest" }) };
        const integrator = new AutonomousRepairIntegrator(process.cwd(), aprvl as any, capability as any);
        const result = await integrator.repairFailure(
            "VERIFY_FAILED",
            "Backend/HBOS/TestFailure.ts",
            {
                authorization: { authorized: true, authorizationToken: "token" },
                action: { action: "replace-file", relativePath: "Backend/HBOS/TestFailure.ts", expectedSha256: "expected", content: "content" },
            },
        );
        expect(result.aprvl.verified).toBe(true);
        expect(result.repaired).toBe(true);
        expect(result.repair?.verified).toBe(true);
    });
});
