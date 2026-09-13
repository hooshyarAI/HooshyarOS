import { EngineRegistry } from "../Engines/EngineRegistry";
import { MemoryEngine } from "../Engines/MemoryEngine";
import { OrganizationalIntelligenceEngine } from "../Engines/OrganizationalIntelligenceEngine";
import { AutonomousOperationsEngine } from "../Engines/AutonomousOperationsEngine";
import { GovernanceEngine } from "../Engines/GovernanceEngine";
import { ReasoningEngine } from "../Engines/ReasoningEngine";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal, PrincipalType } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";
import { MemoryEvent } from "../Entities/MemoryEvent";

describe("Phase 11 Hostile QC", () => {
    const tenantA = "tenant-hostile-a";
    const tenantB = "tenant-hostile-b";
    const makeContext = (tenantId: string, overrides: Partial<SecurityContext> = {}): SecurityContext => ({
        actor: { id: "actor-1", type: PrincipalType.HumanUser, tenantId },
        tenantId,
        timestamp: new Date().toISOString(),
        traceId: undefined,
        permissions: [Authorization.EXECUTE, Authorization.WRITE, Authorization.APPROVE, Authorization.ACCESS_EVIDENCE],
        ...overrides,
    });

    beforeEach(() => {
        EngineRegistry.resetInstance();
    });

    afterEach(() => {
        EngineRegistry.resetInstance();
    });

    test("cross-tenant memory access is rejected by MemoryEngine.retrieve", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        memory.initialize();
        registry.register(memory);

        memory.store(new MemoryEvent("KPI_Secret", "secret-data", "source-a", tenantA));

        const tenantAEvents = memory.retrieve(tenantA);
        expect(tenantAEvents.length).toBe(1);

        const tenantBEvents = memory.retrieve(tenantB);
        expect(tenantBEvents.length).toBe(0);
    });

    test("unauthorized autonomous workflow execution is denied", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        const autoOps = new AutonomousOperationsEngine();
        memory.initialize();
        autoOps.initialize();
        registry.register(memory);
        registry.register(autoOps);

        const plan = autoOps.planWorkflow("hostile-test", { requiredApprovals: ["human-approver"] });
        expect(plan.status).toBe("READY");

        const wrongContext = makeContext(tenantB, {
            permissions: [Authorization.EXECUTE],
        });
        const execution = autoOps.executeAuthorizedWorkflow(plan.workflowId, wrongContext);
        expect(execution.complianceStatus).toBe("NON_COMPLIANT");
    });

    test("governance denies sensitive action without approval", () => {
        const registry = EngineRegistry.getInstance();
        const governance = new GovernanceEngine();
        governance.initialize();
        registry.register(governance);

        governance.addPolicy({
            id: "deny-sensitive",
            description: "Deny sensitive actions without approval",
            match: (request) => request.action === "ACCESS_SENSITIVE_DATA" ? { matched: true } : null,
            evaluate: () => ({ effect: "DENY", reason: "Sensitive data requires explicit approval" }),
        });

        const result = governance.evaluate({
            action: "ACCESS_SENSITIVE_DATA",
            securityContext: makeContext(tenantA),
        });
        expect(result.status).toBe("DENIED");
        expect(result.reasons.length).toBeGreaterThan(0);
    });

    test("reasoning engine rejects empty/malicious input without fabrication", () => {
        const reasoning = new ReasoningEngine();
        reasoning.initialize();

        const empty = reasoning.reason("");
        expect(empty.success).toBe(false);
        expect(empty.status).toBe("invalid_problem");
        expect(empty.provenance?.verificationStatus).toBe("PENDING");

        const whitespace = reasoning.reason("   ");
        expect(whitespace.success).toBe(false);
        expect(whitespace.status).toBe("invalid_problem");
    });

    test("provenance fields are never fabricated when evidence is absent", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        const orgIntel = new OrganizationalIntelligenceEngine();
        memory.initialize();
        orgIntel.initialize();
        registry.register(memory);
        registry.register(orgIntel);

        const diagnosis = orgIntel.diagnose("", {});
        expect(diagnosis.status).toBe("BLOCKED");
        expect(diagnosis.provenance.verificationStatus).toBe("FAILED");
        expect(diagnosis.provenance.sourceRef).toBe("unavailable");
    });

    test("workflow plan blocks invalid goals and constraints", () => {
        const registry = EngineRegistry.getInstance();
        const autoOps = new AutonomousOperationsEngine();
        autoOps.initialize();
        registry.register(autoOps);

        const emptyGoal = autoOps.planWorkflow("", { requiredApprovals: ["human-approver"] });
        expect(emptyGoal.status).toBe("BLOCKED");

        const excessiveDuration = autoOps.planWorkflow("normal goal", {
            requiredApprovals: ["human-approver"],
            maxDuration: 1,
        });
        expect(excessiveDuration.status).toBe("BLOCKED");
    });
});
