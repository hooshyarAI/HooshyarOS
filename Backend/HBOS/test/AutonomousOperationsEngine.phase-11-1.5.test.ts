import { AutonomousOperationsEngine } from "../Engines/AutonomousOperationsEngine";
import { EngineRegistry } from "../Engines/EngineRegistry";
import { SecurityContext } from "../Security/SecurityContext";
import { Authorization } from "../Security/Authorization";
import { Principal } from "../Security/Principals";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";

function autonomousCtx(tenantId: string = "tenant-a"): SecurityContext {
    return SecurityContext.forAutonomousOperation(
        Principal.autonomousOperation("op-1", "AutonomousDaemon", tenantId)
    );
}

function unauthorizedCtx(): SecurityContext {
    return SecurityContext.forService(
        Principal.serviceIdentity("svc-1", "tenant-a"),
        [Authorization.READ]
    );
}

describe("AutonomousOperationsEngine Phase 11-1.5 - Workflow Automation & Coordination", () => {
    let engine: AutonomousOperationsEngine;

    beforeEach(() => {
        EngineRegistry.resetInstance();
        engine = new AutonomousOperationsEngine();
        engine.initialize();
    });

    describe("Engine interface compliance", () => {
        it("has name = AutonomousOperationsEngine", () => {
            expect(engine.name).toBe("AutonomousOperationsEngine");
        });
        it("initialize() and health() succeed", () => {
            expect(typeof engine.health()).toBe("boolean");
            expect(engine.health()).toBe(true);
        });
        it("registers itself in EngineRegistry on initialize", () => {
            const reg = EngineRegistry.getInstance();
            expect(reg.getEngine("AutonomousOperationsEngine")).toBe(engine);
        });
    });

    describe("planWorkflow", () => {
        it("creates a valid workflow plan with steps and provenance", () => {
            const plan = engine.planWorkflow("deploy quarterly report", { requiredApprovals: ["APPROVE"] });
            expect(plan.status).toBe("READY");
            expect(plan.goal).toBe("deploy quarterly report");
            expect(plan.steps.length).toBeGreaterThan(0);
            expect(plan.requiredApprovals).toContain("APPROVE");
            expect(plan.estimatedDuration).toBeGreaterThan(0);
            expect(plan.estimatedBudget).toBeGreaterThan(0);
            expect(plan.provenance.traceId).toMatch(/^TRACE-/);
            expect(plan.provenance.inputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(plan.provenance.outputHash).toMatch(/^[a-f0-9]{64}$/);
            expect(plan.provenance.verificationStatus).toBe("VERIFIED");
            expect(plan.provenance.sourceRef).toBe("AutonomousOperationsEngine");
            expect(plan.provenance.reasoningSteps.length).toBeGreaterThan(0);
        });

        it("returns BLOCKED for empty goal", () => {
            const plan = engine.planWorkflow("", { requiredApprovals: ["APPROVE"] });
            expect(plan.status).toBe("BLOCKED");
            expect(plan.steps).toHaveLength(0);
        });

        it("returns BLOCKED when requiredApprovals is empty", () => {
            const plan = engine.planWorkflow("some goal", { requiredApprovals: [] });
            expect(plan.status).toBe("BLOCKED");
        });

        it("returns BLOCKED when estimatedDuration exceeds maxDuration", () => {
            const plan = engine.planWorkflow("goal", { requiredApprovals: ["APPROVE"], maxDuration: 1 });
            expect(plan.status).toBe("BLOCKED");
        });

        it("returns BLOCKED when estimatedBudget exceeds maxBudget", () => {
            const plan = engine.planWorkflow("goal", { requiredApprovals: ["APPROVE"], maxBudget: 1 });
            expect(plan.status).toBe("BLOCKED");
        });
    });

    describe("coordinateAgents", () => {
        it("assigns valid agents with full provenance", () => {
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            const result = engine.coordinateAgents(plan.workflowId, [
                { agentType: "worker", agentId: "a-1", task: "build", authority: "EXECUTE" },
                { agentType: "reviewer", agentId: "a-2", task: "verify", authority: "APPROVE" }
            ]);
            expect(result.executionStatus).toBe("COORDINATED");
            expect(result.assignedAgents).toHaveLength(2);
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.provenance.sourceRef).toBe("AutonomousOperationsEngine");
        });

        it("returns BLOCKED for empty workflowId", () => {
            const result = engine.coordinateAgents("", [{ agentType: "x", agentId: "a", task: "t", authority: "EXECUTE" }]);
            expect(result.executionStatus).toBe("BLOCKED");
            expect(result.assignedAgents).toHaveLength(0);
        });

        it("returns BLOCKED for empty agent list", () => {
            const result = engine.coordinateAgents("wf", []);
            expect(result.executionStatus).toBe("BLOCKED");
        });

        it("returns PARTIAL when some agents are invalid", () => {
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            const result = engine.coordinateAgents(plan.workflowId, [
                { agentType: "worker", agentId: "a-1", task: "build", authority: "EXECUTE" },
                { agentType: "", agentId: "", task: "", authority: "" }
            ]);
            expect(result.executionStatus).toBe("PARTIAL");
            expect(result.assignedAgents).toHaveLength(1);
        });
    });

    describe("executeAuthorizedWorkflow", () => {
        it("executes with valid autonomous security context", () => {
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            const ctx = autonomousCtx("tenant-a");
            const result = engine.executeAuthorizedWorkflow(plan.workflowId, ctx);
            expect(["EXECUTED", "FAILED"]).toContain(result.status);
            expect(result.results.length).toBeGreaterThan(0);
            expect(result.provenance.traceId).toMatch(/^TRACE-/);
            expect(result.tenantId).toBe("tenant-a");
            expect(["COMPLIANT", "REVIEW_REQUIRED"]).toContain(result.complianceStatus);
        });

        it("blocks with unauthorized security context (non-autonomous, missing EXECUTE)", () => {
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            const ctx = unauthorizedCtx();
            const result = engine.executeAuthorizedWorkflow(plan.workflowId, ctx);
            expect(result.status).toBe("BLOCKED");
            expect(result.complianceStatus).toBe("NON_COMPLIANT");
            expect(result.results[0]).toMatch(/Authorization denied/);
        });

        it("blocks with empty security context", () => {
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            const result = engine.executeAuthorizedWorkflow(plan.workflowId, SecurityContext.empty());
            expect(result.status).toBe("BLOCKED");
            expect(result.complianceStatus).toBe("NON_COMPLIANT");
        });

        it("blocks when workflow plan is missing", () => {
            const result = engine.executeAuthorizedWorkflow("nonexistent-id", autonomousCtx());
            expect(result.status).toBe("BLOCKED");
        });

        it("blocks with empty workflowId", () => {
            const result = engine.executeAuthorizedWorkflow("", autonomousCtx());
            expect(result.status).toBe("BLOCKED");
        });
    });

    describe("monitorExecution", () => {
        it("returns UNKNOWN for unseen workflow", () => {
            const m = engine.monitorExecution("never-executed");
            expect(m.status).toBe("UNKNOWN");
            expect(m.progressPercent).toBe(0);
            expect(m.provenance.traceId).toMatch(/^TRACE-/);
        });

        it("tracks workflow progress after execution", () => {
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            const result = engine.executeAuthorizedWorkflow(plan.workflowId, autonomousCtx());
            const m = engine.monitorExecution(plan.workflowId);
            expect(["RUNNING", "COMPLETED", "FAILED"]).toContain(m.status);
            if (result.status === "EXECUTED") {
                expect(m.progressPercent).toBe(100);
                expect(m.status).toBe("COMPLETED");
            } else {
                expect(m.status).toBe("FAILED");
            }
            expect(m.logs.length).toBeGreaterThan(0);
        });
    });

    describe("rollbackOnFailure", () => {
        it("rolls back when execution has failed", () => {
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            engine.executeAuthorizedWorkflow(plan.workflowId, autonomousCtx());
            const rb = engine.rollbackOnFailure(plan.workflowId, "engine unhealthy");
            expect(typeof rb.wasRolledBack).toBe("boolean");
            expect(rb.reason).toBe("engine unhealthy");
            expect(rb.previousState).toBeDefined();
            expect(rb.provenance.traceId).toMatch(/^TRACE-/);
        });

        it("returns previousState even when no execution exists", () => {
            const rb = engine.rollbackOnFailure("never-executed", "manual");
            expect(rb.wasRolledBack).toBe(false);
            expect(rb.previousState).toBe("no-prior-state");
        });
    });

    describe("provenance chain", () => {
        it("produces distinct traceIds for each method call", () => {
            const ids = new Set<string>();
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            ids.add(plan.provenance.traceId);
            const coord = engine.coordinateAgents(plan.workflowId, [{ agentType: "w", agentId: "a", task: "t", authority: "EXECUTE" }]);
            ids.add(coord.provenance.traceId);
            const exec = engine.executeAuthorizedWorkflow(plan.workflowId, autonomousCtx());
            ids.add(exec.provenance.traceId);
            const mon = engine.monitorExecution(plan.workflowId);
            ids.add(mon.provenance.traceId);
            const rb = engine.rollbackOnFailure(plan.workflowId, "reason");
            ids.add(rb.provenance.traceId);
            expect(ids.size).toBeGreaterThanOrEqual(4);
        });

        it("verifies hashes match canonical ProvenanceTrace.hashInput", () => {
            const plan = engine.planWorkflow("verify-hash", { requiredApprovals: ["APPROVE"] });
            const inputStr = JSON.stringify({ goal: "verify-hash", constraints: { requiredApprovals: ["APPROVE"] } });
            expect(plan.provenance.inputHash).toBe(ProvenanceTrace.hashInput(inputStr));
            expect(plan.provenance.outputHash.length).toBe(64);
        });
    });

    describe("integration with composed engines", () => {
        it("integrates DecisionEngine, ProjectPilotEngine, GovernanceEngine, HealthMonitorEngine", () => {
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            expect(plan.steps.map(s => s.assignedEngine)).toContain("DecisionEngine");
            expect(plan.steps.map(s => s.assignedEngine)).toContain("ProjectPilotEngine");
            expect(plan.steps.map(s => s.assignedEngine)).toContain("GovernanceEngine");
            expect(plan.steps.map(s => s.assignedEngine)).toContain("HealthMonitorEngine");
        });

        it("composed engines are healthy after initialize", () => {
            expect(engine.health()).toBe(true);
        });
    });

    describe("edge cases", () => {
        it("planWorkflow handles whitespace-only goal", () => {
            const plan = engine.planWorkflow("   ", { requiredApprovals: ["APPROVE"] });
            expect(plan.status).toBe("BLOCKED");
        });

        it("coordinateAgents preserves agent metadata", () => {
            const plan = engine.planWorkflow("g", { requiredApprovals: ["APPROVE"] });
            const r = engine.coordinateAgents(plan.workflowId, [{ agentType: "x", agentId: "id1", task: "task1", authority: "AUTH1" }]);
            expect(r.assignedAgents[0].agentType).toBe("x");
            expect(r.assignedAgents[0].agentId).toBe("id1");
            expect(r.assignedAgents[0].task).toBe("task1");
            expect(r.assignedAgents[0].authority).toBe("AUTH1");
            expect(r.assignedAgents[0].assignedAt).toBeDefined();
        });
    });
});

