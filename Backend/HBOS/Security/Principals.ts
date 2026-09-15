/**
 * Phase 05C-B - Identity and Authorization Contracts
 *
 * Security Principals:
 * - HumanUser: authenticated human actor
 * - Tenant: organizational boundary
 * - ServiceIdentity: service/component identity
 * - AutonomousOperation: autonomous actor (e.g., Kilo Code operator)
 * - ExternalIntegration: external API/integration identity
 *
 * Design principles:
 * - Deny by default
 * - Explicit authorization required for sensitive operations
 * - Tenant is the primary isolation boundary
 */

/**
 * Types of security principals
 */
export enum PrincipalType {
    HumanUser = "HumanUser",
    ServiceIdentity = "ServiceIdentity",
    AutonomousOperation = "AutonomousOperation",
    ExternalIntegration = "ExternalIntegration"
}

/**
 * Base interface for all security principals
 */
export interface Principal {
    readonly id: string;
    readonly type: PrincipalType;
    readonly tenantId?: string; // Undefined for system/global principals
}

/**
 * Human user principal
 */
export interface HumanUser extends Principal {
    readonly type: PrincipalType.HumanUser;
    readonly userId: string;
    readonly tenantId: string; // Humans always belong to a tenant
}

/**
 * Tenant principal (organizational boundary)
 */
export interface Tenant {
    readonly id: string;
    readonly type: "Tenant";
    readonly name: string;
}

/**
 * Service/component identity
 */
export interface ServiceIdentity extends Principal {
    readonly type: PrincipalType.ServiceIdentity;
    readonly serviceId: string;
    readonly tenantId?: string; // Optional - some services are system-wide
}

/**
 * Autonomous operation principal (e.g., Kilo Code operator)
 */
export interface AutonomousOperation extends Principal {
    readonly type: PrincipalType.AutonomousOperation;
    readonly operationId: string;
    readonly operatorType: string; // e.g., "KiloCode", "AutonomousDaemon"
    readonly tenantId?: string; // Optional - autonomous ops may be system or tenant-scoped
}

/**
 * External integration principal
 */
export interface ExternalIntegration extends Principal {
    readonly type: PrincipalType.ExternalIntegration;
    readonly integrationId: string;
    readonly tenantId?: string;
}

/**
 * Principal factory functions for type-safe creation
 */
export const Principal = {
    humanUser(userId: string, tenantId: string): HumanUser {
        return { id: userId, type: PrincipalType.HumanUser, userId, tenantId };
    },

    serviceIdentity(serviceId: string, tenantId?: string): ServiceIdentity {
        return { id: serviceId, type: PrincipalType.ServiceIdentity, serviceId, tenantId };
    },

    autonomousOperation(operationId: string, operatorType: string, tenantId?: string): AutonomousOperation {
        return { id: operationId, type: PrincipalType.AutonomousOperation, operationId, operatorType, tenantId };
    },

    externalIntegration(integrationId: string, tenantId?: string): ExternalIntegration {
        return { id: integrationId, type: PrincipalType.ExternalIntegration, integrationId, tenantId };
    }
};
