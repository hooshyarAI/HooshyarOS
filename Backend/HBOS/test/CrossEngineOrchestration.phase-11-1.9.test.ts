import { EngineRegistry } from "../Engines/EngineRegistry";
import { LifecycleManager } from "../Engines/LifecycleManager";
import { HealthMonitorEngine } from "../Engines/HealthMonitorEngine";
import { MemoryEngine } from "../Engines/MemoryEngine";
import { KnowledgeEngine } from "../Engines/KnowledgeEngine";
import { DecisionEngine } from "../Engines/DecisionEngine";
import { ProjectPilotEngine } from "../Engines/ProjectPilotEngine";
import { OrganizationalIntelligenceEngine } from "../Engines/OrganizationalIntelligenceEngine";
import { ExecutiveIntelligenceEngine } from "../Engines/ExecutiveIntelligenceEngine";
import { AutonomousOperationsEngine } from "../Engines/AutonomousOperationsEngine";
import { GovernanceEngine } from "../Engines/GovernanceEngine";
import { ReasoningEngine } from "../Engines/ReasoningEngine";
import { AssistantEngine } from "../Engines/AssistantEngine";
import { SecurityContext } from "../Security/SecurityContext";
import { Principal, PrincipalType } from "../Security/Principals";
import { Authorization } from "../Security/Authorization";
import { MemoryEvent } from "../Entities/MemoryEvent";
import { ProjectStatus } from "../Core/ProjectStatus";
import { Project } from "../Entities/Project";
import { DecisionContext } from "../Core/DecisionContext";

describe("Cross-Engine Orchestration Phase 11-1.9", () => {
    const tenantId = "tenant-integration-1";
    const makeContext = (overrides: Partial<SecurityContext> = {}): SecurityContext => ({
        actor: { id: "actor-1", type: PrincipalType.HumanUser, tenantId },
        tenantId,
        timestamp: new Date().toISOString(),
        traceId: undefined,
        permissions: [Authorization.EXECUTE, Authorization.WRITE, Authorization.APPROVE, Authorization.ACCESS_EVIDENCE],
        ...overrides,
    });

    beforeEach(() => {
        EngineRegistry.resetInstance();
        LifecycleManager.resetInstance();
    });

    afterEach(() => {
        EngineRegistry.resetInstance();
        LifecycleManager.resetInstance();
    });

    test("all canonical engines register and report healthy", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        const knowledge = new KnowledgeEngine();
        const decision = new DecisionEngine();
        const projectPilot = new ProjectPilotEngine();
        const orgIntel = new OrganizationalIntelligenceEngine();
        const execIntel = new ExecutiveIntelligenceEngine();
        const autoOps = new AutonomousOperationsEngine();
        const governance = new GovernanceEngine();
        const reasoning = new ReasoningEngine();
        const assistant = new AssistantEngine();
        const health = new HealthMonitorEngine();

        const engines = [memory, knowledge, decision, projectPilot, orgIntel, execIntel, autoOps, governance, reasoning, assistant, health];
        for (const engine of engines) {
            engine.initialize();
            registry.register(engine);
        }

        const all = registry.getAllEngines();
        expect(all.length).toBeGreaterThanOrEqual(10);
        for (const engine of all) {
            expect(engine.health()).toBe(true);
        }
    });

    test("organizational diagnosis flows through ReasoningEngine and OrgIntel with provenance", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        const reasoning = new ReasoningEngine();
        const orgIntel = new OrganizationalIntelligenceEngine();
        memory.initialize();
        reasoning.initialize();
        orgIntel.initialize();
        registry.register(memory);
        registry.register(reasoning);
        registry.register(orgIntel);

        const evidence = {
            delay: true,
            resource: true,
            quality: false,
        };

        const diagnosis = orgIntel.diagnose("integration-scope", evidence);
        expect(diagnosis.status).toBe("READY");
        expect(diagnosis.provenance.traceId).toMatch(/^TRACE-/);
        expect(diagnosis.provenance.verificationStatus).toBe("VERIFIED");
        expect(diagnosis.rootCauses.length).toBeGreaterThan(0);
        expect(diagnosis.recommendations.length).toBeGreaterThan(0);
    });

    test("executive intelligence evaluates KPIs and generates dashboard primitives with provenance", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        const execIntel = new ExecutiveIntelligenceEngine();
        memory.initialize();
        execIntel.initialize();
        registry.register(memory);
        registry.register(execIntel);

        const event = new MemoryEvent("KPI_Revenue", JSON.stringify({ actual: 120, target: 100 }), "integration-test", tenantId);
        memory.store(event);

        const primitives = execIntel.generateDashboardPrimitives(tenantId);
        expect(primitives.kpis.length).toBeGreaterThan(0);
        expect(primitives.provenance.traceId).toMatch(/^TRACE-/);
        expect(primitives.strategicAlignment.alignmentScore).toBeGreaterThanOrEqual(0);
        expect(primitives.balancedGrowthIndicators.dimensions.length).toBeGreaterThan(0);
    });

    test("autonomous operations plans, coordinates and executes workflow", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        const decision = new DecisionEngine();
        const projectPilot = new ProjectPilotEngine();
        const governance = new GovernanceEngine();
        const health = new HealthMonitorEngine();
        const autoOps = new AutonomousOperationsEngine();
        memory.initialize();
        decision.initialize();
        projectPilot.initialize();
        governance.initialize();
        health.initialize();
        autoOps.initialize();
        registry.register(memory);
        registry.register(decision);
        registry.register(projectPilot);
        registry.register(governance);
        registry.register(health);
        registry.register(autoOps);

        const plan = autoOps.planWorkflow("integration improvement", {
            requiredApprovals: ["human-approver"],
        });
        expect(plan.status).toBe("READY");
        expect(plan.provenance.traceId).toMatch(/^TRACE-/);

        const coordination = autoOps.coordinateAgents(plan.workflowId, [
            { agentType: "test", agentId: "agent-1", task: "execute", authority: "EXECUTE" },
        ]);
        expect(coordination.executionStatus).toBe("COORDINATED");

        const securityContext: SecurityContext = {
            actor: { id: "actor-1", type: PrincipalType.AutonomousOperation, tenantId },
            tenantId,
            timestamp: new Date().toISOString(),
            traceId: undefined,
            permissions: [Authorization.EXECUTE, Authorization.APPROVE],
        };
        const execution = autoOps.executeAuthorizedWorkflow(plan.workflowId, securityContext);
        expect(execution.complianceStatus).toBe("COMPLIANT");
        expect(execution.provenance.traceId).toMatch(/^TRACE-/);
    });

    test("governance enforces policy and logs audit trail", () => {
        const registry = EngineRegistry.getInstance();
        const governance = new GovernanceEngine();
        governance.initialize();
        registry.register(governance);

        governance.addPolicy({
            id: "integration-policy",
            description: "Allow integration operations",
            match: () => ({ matched: true }),
            evaluate: () => ({ effect: "ALLOW", reason: "Integration test policy" }),
        });

        const result = governance.evaluate({
            action: "EXECUTE_AUTONOMOUS_OPERATION",
            securityContext: makeContext(),
        });
        expect(result.status).toBe("ALLOWED");
        expect(result.traceId).toMatch(/^TRACE-/);
        expect(result.appliedPolicies).toContain("integration-policy");
    });

    test("reasoning engine produces provenance-bounded output", () => {
        const reasoning = new ReasoningEngine();
        reasoning.initialize();

        const result = reasoning.reason("integration test problem");
        expect(result.success).toBe(true);
        expect(result.status).toBe("reasoned");
        expect(result.provenance).toBeDefined();
        expect(result.provenance!.traceId).toMatch(/^TRACE-/);
        expect(result.provenance!.explainability).toBeDefined();
    });

    test("assistant engine analyzes project with evidence and returns provenance", () => {
        const assistant = new AssistantEngine();
        assistant.initialize();

        const project = new Project("Integration Project");
        project.status = ProjectStatus.Active;
        const evidence = DecisionContext.fromEvidence({
            traceId: "integration-trace",
            inputHash: "integration-hash",
            explanation: "Integration evidence",
        });
        const response = assistant.analyzeProject(project, evidence);
        expect(response.project).toBe(project);
        expect(response.traceId).toBe("integration-trace");
        expect(response.inputHash).toBe("integration-hash");
        expect(response.explanation).toBe("Integration evidence");
    });

    test("provenance chains are distinct and verifiable across engines", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        const orgIntel = new OrganizationalIntelligenceEngine();
        const autoOps = new AutonomousOperationsEngine();
        memory.initialize();
        orgIntel.initialize();
        autoOps.initialize();
        registry.register(memory);
        registry.register(orgIntel);
        registry.register(autoOps);

        const traceIds = new Set<string>();

        const diagnosis = orgIntel.diagnose("provenance-test", { delay: true });
        traceIds.add(diagnosis.provenance.traceId);

        const plan = autoOps.planWorkflow("provenance-test", { requiredApprovals: [] });
        traceIds.add(plan.provenance.traceId);

        const execResult = autoOps.executeAuthorizedWorkflow(plan.workflowId, makeContext());
        traceIds.add(execResult.provenance.traceId);

        expect(traceIds.size).toBe(3);
        for (const traceId of traceIds) {
            expect(traceId).toMatch(/^TRACE-/);
        }
    });

    test("tenant isolation is preserved across memory and intelligence engines", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        const execIntel = new ExecutiveIntelligenceEngine();
        memory.initialize();
        execIntel.initialize();
        registry.register(memory);
        registry.register(execIntel);

        memory.store(new MemoryEvent("KPI_TenantTest", JSON.stringify({ actual: 50, target: 100 }), "tenant-isolation-test", tenantId));

        const allEvents = memory.retrieve();
        expect(allEvents.length).toBe(1);
        expect(allEvents[0].tenantId).toBe(tenantId);

        const tenantEvents = memory.retrieve(tenantId);
        expect(tenantEvents.length).toBe(1);

        const otherEvents = memory.retrieve("other-tenant");
        expect(otherEvents.length).toBe(0);
    });

    test("full cross-engine loop completes end-to-end with measurable output", () => {
        const registry = EngineRegistry.getInstance();
        const memory = new MemoryEngine();
        const orgIntel = new OrganizationalIntelligenceEngine();
        const execIntel = new ExecutiveIntelligenceEngine();
        const autoOps = new AutonomousOperationsEngine();
        const reasoning = new ReasoningEngine();
        memory.initialize();
        orgIntel.initialize();
        execIntel.initialize();
        autoOps.initialize();
        reasoning.initialize();
        registry.register(memory);
        registry.register(orgIntel);
        registry.register(execIntel);
        registry.register(autoOps);
        registry.register(reasoning);

        memory.store(new MemoryEvent("KPI_Revenue", JSON.stringify({ actual: 80, target: 100 }), "e2e-test", tenantId));

        const diagnosis = orgIntel.diagnose("e2e-scope", { delay: true, resource: true });
        expect(diagnosis.status).toBe("READY");

        const primitives = execIntel.generateDashboardPrimitives(tenantId);
        expect(primitives.kpis.length).toBeGreaterThan(0);

        const plan = autoOps.planWorkflow("e2e-improvement", { requiredApprovals: ["human-approver"] });
        expect(plan.status).toBe("READY");

        const securityContext: SecurityContext = {
            actor: { id: "actor-1", type: PrincipalType.AutonomousOperation, tenantId },
            tenantId,
            timestamp: new Date().toISOString(),
            traceId: undefined,
            permissions: [Authorization.EXECUTE, Authorization.APPROVE],
        };
        const execution = autoOps.executeAuthorizedWorkflow(plan.workflowId, securityContext);
        expect(execution.complianceStatus).toBe("COMPLIANT");

        const learning = orgIntel.learnFromExecution(
            { cycleTime: 100, throughput: 10, errorRate: 5, capacity: 100, cost: 1000 },
            { cycleTime: 80, throughput: 12, errorRate: 3, capacity: 120, cost: 800 }
        );
        expect(learning.sustainability).toBe("SUSTAINABLE");
        expect(learning.actualROI).toBeGreaterThan(0);

        const reasoned = reasoning.reason("e2e reasoning test");
        expect(reasoned.success).toBe(true);
        expect(reasoned.provenance!.verificationStatus).toBe("VERIFIED");
    });
});
