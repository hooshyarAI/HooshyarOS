import { AutonomousRepairEngine, RepairExecutionPort } from "../RepairEngine/AutonomousRepairEngine";
import { AutonomousRepairIntegrator } from "../Integration/AutonomousRepairIntegrator";

describe("AutonomousRepairEngine", () => {
    test("creates governed repair plan and delegates execution", () => {
        const executor: RepairExecutionPort = {
            execute: plan => ({
                repaired: true,
                plan,
                evidence: {
                    repaired: true,
                    verificationPassed: true,
                    integrationVerified: true,
                    architectureVerified: true,
                    failureTheoryAssessed: true
                }
            })
        };
        const engine = new AutonomousRepairEngine(executor);
        const plan = engine.createPlan("AUTONOMOUS_VERIFY_FAILED", "Backend/HBOS/TestFailure.ts", "product.financial-data-ingestion");
        const result = engine.execute(plan);

        expect(plan.action).toContain("platform-native repair capability");
        expect(plan.requiredEvidence).toContain("ARCHITECTURE_VERIFIED");
        expect(result.repaired).toBe(true);
        expect(result.evidence.verificationPassed).toBe(true);
    });

    test("fails closed when the mutation executor is not wired", () => {
        const engine = new AutonomousRepairEngine();
        const plan = engine.createPlan("VERIFY_FAILED");
        const result = engine.execute(plan);

        expect(result.repaired).toBe(false);
        expect(result.evidence.reason).toBe("REPAIR_EXECUTOR_UNWIRED");
    });
});

describe("AutonomousRepairIntegrator", () => {
    test("wires repair planning to the platform construction executor", () => {
        const integrator = new AutonomousRepairIntegrator();
        const result = integrator.repairFailure("VERIFY_FAILED", "Backend/HBOS/TestFailure.ts", {
            capabilityId: "product.financial-data-ingestion"
        });

        expect(result.plan.capabilityId).toBe("product.financial-data-ingestion");
        expect(result.plan.action).toContain("platform-native repair capability");
        expect(result.evidence).toBeDefined();
    });
});
