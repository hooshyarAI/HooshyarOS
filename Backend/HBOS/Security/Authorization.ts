/**
 * Phase 05C-B - Authorization Types
 *
 * Authorization types for HooshyarOS security model.
 *
 * Principles:
 * - Deny by default
 * - Explicit authorization required for sensitive operations
 */

/**
 * Authorization action types
 */
export enum Authorization {
    /** Read data or resources */
    READ = "READ",
    /** Write/create/update data or resources */
    WRITE = "WRITE",
    /** Execute decisions or autonomous operations */
    EXECUTE = "EXECUTE",
    /** Approve or override decisions */
    APPROVE = "APPROVE",
    /** Access evidence/provenance records */
    ACCESS_EVIDENCE = "ACCESS_EVIDENCE",
    /** Administrative operations (tenant management, security config) */
    ADMINISTER = "ADMINISTER"
}

/**
 * Authorization action definitions with descriptions
 */
export const AuthorizationDescription: Record<Authorization, string> = {
    [Authorization.READ]: "Read data or resources within tenant scope",
    [Authorization.WRITE]: "Write or modify data or resources within tenant scope",
    [Authorization.EXECUTE]: "Execute decisions or autonomous operations",
    [Authorization.APPROVE]: "Approve or override decisions",
    [Authorization.ACCESS_EVIDENCE]: "Access evidence, provenance, or audit records",
    [Authorization.ADMINISTER]: "Administrative operations including tenant and security management"
};

/**
 * Authorization result
 */
export enum AuthorizationResult {
    /** Action is permitted */
    PERMITTED = "PERMITTED",
    /** Action is denied */
    DENIED = "DENIED",
    /** Insufficient permissions */
    FORBIDDEN = "FORBIDDEN",
    /** Missing required context (e.g., no actor) */
    MISSING_CONTEXT = "MISSING_CONTEXT"
}
