import { Engine } from "../Core/Engine";
import { OrganizationModelEngine } from "./OrganizationModelEngine";
import { UserManagementEngine } from "./UserManagementEngine";
import { SecurityContext } from "../Security/SecurityContext";
import { Authorization, AuthorizationResult as SecurityAuthorizationResult } from "../Security/Authorization";
import { AuthorizationGuard } from "../Security/AuthorizationGuard";
import { TenantIsolation, TenantResource } from "../Security/TenantIsolation";

export interface AuthorizationResult {
    subject: string;
    status: "READY" | "BLOCKED";
}

export interface PolicyEvaluationResult {
    readonly result: SecurityAuthorizationResult;
    readonly reason: string;
    readonly traceId?: string;
}

export interface TenantIsolationVerificationResult {
    readonly isolated: boolean;
    readonly reason: string;
    readonly tenantId?: string;
}

export interface EncryptionBoundaryResult {
    readonly compliant: boolean;
    readonly reason: string;
}

export interface DataClassificationResult {
    readonly classified: boolean;
    readonly sensitivity: "PUBLIC" | "INTERNAL" | "CONFIDENTIAL" | "SENSITIVE";
    readonly reason: string;
}

/** Canonical Phase 2 authorization boundary. */
export class SecurityLayerEngine implements Engine {
    name = "SecurityLayerEngine";
    private readonly users = new UserManagementEngine();
    private readonly organizations = new OrganizationModelEngine();

    initialize(): void {
        this.users.initialize();
        this.organizations.initialize();
    }

    health(): boolean {
        return this.users.health() && this.organizations.health();
    }

    authorize(subject: string): AuthorizationResult {
        const value = subject?.trim() ?? "";
        return { subject: value, status: value && this.health() ? "READY" : "BLOCKED" };
    }

    evaluatePolicy(context: SecurityContext, action: Authorization, resource: TenantResource): PolicyEvaluationResult {
        const guardResult = AuthorizationGuard.check(context, action);
        if (guardResult.result !== SecurityAuthorizationResult.PERMITTED) {
            return {
                result: guardResult.result,
                reason: guardResult.reason,
                traceId: context.traceId
            };
        }

        const isolationResult = TenantIsolation.checkAccess(context, resource, action);
        if (isolationResult.result !== SecurityAuthorizationResult.PERMITTED) {
            return {
                result: isolationResult.result,
                reason: isolationResult.reason,
                traceId: context.traceId
            };
        }

        return {
            result: SecurityAuthorizationResult.PERMITTED,
            reason: "Policy evaluation passed",
            traceId: context.traceId
        };
    }

    verifyTenantIsolation(resource: TenantResource): TenantIsolationVerificationResult {
        if (resource.tenantId === undefined || resource.tenantId === null) {
            return {
                isolated: true,
                reason: "Global resource — no tenant isolation required"
            };
        }

        const tenantId = resource.tenantId.trim();
        if (tenantId.length === 0) {
            return {
                isolated: false,
                reason: "Resource has empty tenantId — tenant isolation violated"
            };
        }

        return {
            isolated: true,
            reason: "Resource is properly tenant-scoped",
            tenantId
        };
    }

    checkEncryptionBoundary(dataType: string): EncryptionBoundaryResult {
        const normalizedType = dataType?.trim() ?? "";
        if (normalizedType.length === 0) {
            return {
                compliant: false,
                reason: "Data type must be specified for encryption boundary check"
            };
        }

        const sensitiveTypes = ["CONFIDENTIAL", "SENSITIVE_FINANCIAL_PERSONAL", "PII", "CREDENTIAL"];
        const requiresEncryption = sensitiveTypes.some(type => normalizedType.toUpperCase().includes(type));

        if (requiresEncryption) {
            return {
                compliant: true,
                reason: `${normalizedType} requires encryption at rest and in transit`
            };
        }

        return {
            compliant: true,
            reason: `${normalizedType} does not require mandatory encryption`
        };
    }

    classifyData(sensitivityHint?: string): DataClassificationResult {
        const hint = sensitivityHint?.trim().toUpperCase() ?? "";
        if (hint.length === 0) {
            return {
                classified: false,
                sensitivity: "INTERNAL",
                reason: "No sensitivity hint provided — defaulting to INTERNAL"
            };
        }

        const sensitiveKeywords: Record<string, "CONFIDENTIAL" | "SENSITIVE"> = {
            "PII": "SENSITIVE",
            "FINANCIAL": "CONFIDENTIAL",
            "CREDENTIAL": "SENSITIVE",
            "SECRET": "SENSITIVE",
            "HEALTH": "SENSITIVE"
        };

        for (const [keyword, sensitivity] of Object.entries(sensitiveKeywords)) {
            if (hint.includes(keyword)) {
                return {
                    classified: true,
                    sensitivity,
                    reason: `Data classified as ${sensitivity} based on hint: ${keyword}`
                };
            }
        }

        return {
            classified: true,
            sensitivity: "INTERNAL",
            reason: "Data classified as INTERNAL — no sensitive keywords detected"
        };
    }
}
