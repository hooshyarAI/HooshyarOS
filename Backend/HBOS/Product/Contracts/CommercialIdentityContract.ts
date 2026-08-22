export type CommercialRole = "OWNER" | "ADMIN" | "MANAGER" | "VIEWER";
export type CommercialPermission = "READ_DASHBOARD" | "INGEST_DATA" | "CREATE_DECISION" | "MANAGE_USERS";

export interface CommercialSession {
    token: string;
    username: string;
    organization: string;
    tenantId: string;
    role: CommercialRole;
    createdAt: string;
    active: boolean;
}

export interface IdentityAuditEvent {
    type: "SESSION_CREATED" | "SESSION_REVOKED" | "AUTHORIZATION_ALLOWED" | "AUTHORIZATION_DENIED";
    username: string;
    organization: string;
    permission?: CommercialPermission;
    createdAt: string;
}
