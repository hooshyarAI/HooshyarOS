/**
 * Phase 05C-E4 Test - Autonomous Operation Audit
 */
import { AutonomousOperationAuditor, createAutonomousAuditPrincipal } from "../Entities/AutonomousAudit";
import { PrincipalType } from "../Security/Principals";
import { AuthorizationResult } from "../Security/Authorization";
import { join } from "node:path";
import { unlinkSync, existsSync } from "node:fs";

const DB_PATH = join(__dirname, "test-autonomous-audit.sqlite");

function cleanup() {
    try { if (existsSync(DB_PATH)) unlinkSync(DB_PATH); } catch { /* ignore */ }
}

describe("AutonomousOperationAuditor", () => {
    afterEach(() => cleanup());

    it("authorizes valid autonomous operation", () => {
        const auditor = new AutonomousOperationAuditor(DB_PATH);

        const operation = createAutonomousAuditPrincipal(
            "op-123",
            "KiloCode",
            "tenant-auto"
        );

        const result = auditor.authorizeAutonomousOperation(operation, "TRACE-auto-001");

        expect(result.authorized).toBe(true);
        expect(result.context.actor?.type).toBe(PrincipalType.AutonomousOperation);
        expect(result.reason).toBe("Autonomous execution authorized");

        auditor.close();
    });

    it("verifies autonomous identity", () => {
        const auditor = new AutonomousOperationAuditor(DB_PATH);

        const validOp = createAutonomousAuditPrincipal("op-valid", "KiloCode", "tenant-1");
        expect(auditor.verifyAutonomousIdentity(validOp)).toBe(true);

        // Invalid - missing operatorType
        const invalidOp1 = {
            id: "op-invalid",
            type: PrincipalType.AutonomousOperation as const,
            operationId: "op-invalid",
            operatorType: "",
            tenantId: undefined
        };
        expect(auditor.verifyAutonomousIdentity(invalidOp1)).toBe(false);

        // Invalid - unknown operatorType
        const invalidOp2 = {
            id: "op-unknown",
            type: PrincipalType.AutonomousOperation as const,
            operationId: "op-unknown",
            operatorType: "UnknownAgent",
            tenantId: undefined
        };
        expect(auditor.verifyAutonomousIdentity(invalidOp2)).toBe(false);

        auditor.close();
    });

    it("audits successful autonomous action", () => {
        const auditor = new AutonomousOperationAuditor(DB_PATH);

        const operation = createAutonomousAuditPrincipal("op-audit", "BuildAgent", "tenant-audit");

        const record = auditor.auditAutonomousAction({
            operation,
            traceId: "TRACE-build-001",
            action: "EXECUTE",
            target: "build:project-1",
            success: true
        });

        expect(record.operationId).toBe("op-audit");
        expect(record.operatorType).toBe("BuildAgent");
        expect(record.result).toBe("SUCCESS");
        expect(record.authorized).toBe(true);

        auditor.close();
    });

    it("audits failed autonomous action", () => {
        const auditor = new AutonomousOperationAuditor(DB_PATH);

        const operation = createAutonomousAuditPrincipal("op-fail", "RepairAgent");

        const record = auditor.auditAutonomousAction({
            operation,
            action: "EXECUTE",
            target: "repair:component-1",
            success: false,
            error: "Component not found"
        });

        expect(record.result).toBe("ERROR");
        expect(record.authorized).toBe(true); // Operation was authorized, execution failed

        auditor.close();
    });

    it("returns empty security events when no audit store configured", () => {
        const auditor = new AutonomousOperationAuditor();
        const events = auditor.getAutonomousSecurityEvents();
        expect(events.length).toBe(0);
        auditor.close();
    });
});
