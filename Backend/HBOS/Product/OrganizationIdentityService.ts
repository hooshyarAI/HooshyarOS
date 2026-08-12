import { OrganizationModelEngine, OrganizationRecord } from "../Engines/OrganizationModelEngine";
import { SecurityLayerEngine } from "../Engines/SecurityLayerEngine";

export type OrganizationRole = "OWNER" | "ADMIN" | "MANAGER" | "EMPLOYEE" | "VIEWER";

export interface OrganizationMember {
    subject: string;
    organization: string;
    role: OrganizationRole;
    status: "ACTIVE" | "BLOCKED";
}

export interface OrganizationSession {
    subject: string;
    organization: string;
    role: OrganizationRole;
    status: "AUTHENTICATED" | "BLOCKED";
    sessionId: string;
}

/**
 * First commercial vertical-slice boundary for organization identity.
 * This is an application/domain contract, not a substitute for a durable
 * authentication provider or persistence implementation.
 */
export class OrganizationIdentityService {
    private readonly organizations = new OrganizationModelEngine();
    private readonly security = new SecurityLayerEngine();

    initialize(): void {
        this.organizations.initialize();
        this.security.initialize();
    }

    health(): boolean {
        return this.organizations.health() && this.security.health();
    }

    createOrganization(name: string): OrganizationRecord {
        return this.organizations.createOrganization(name);
    }

    registerOwner(organization: string, subject: string): OrganizationMember {
        const org = organization?.trim() ?? "";
        const user = subject?.trim() ?? "";
        const authorized = Boolean(org && user && this.health() && this.security.authorize(user).status === "READY");
        return {
            subject: user,
            organization: org,
            role: "OWNER",
            status: authorized ? "ACTIVE" : "BLOCKED"
        };
    }

    openSession(member: OrganizationMember): OrganizationSession {
        if (member.status !== "ACTIVE" || !this.health()) {
            return {
                subject: member.subject,
                organization: member.organization,
                role: member.role,
                status: "BLOCKED",
                sessionId: ""
            };
        }

        const sessionId = `${member.organization}:${member.subject}:${member.role}`;
        return {
            subject: member.subject,
            organization: member.organization,
            role: member.role,
            status: "AUTHENTICATED",
            sessionId
        };
    }

    canAccess(member: OrganizationMember, requiredRole: OrganizationRole): boolean {
        if (member.status !== "ACTIVE" || !this.health()) return false;

        const rank: Record<OrganizationRole, number> = {
            OWNER: 50,
            ADMIN: 40,
            MANAGER: 30,
            EMPLOYEE: 20,
            VIEWER: 10
        };
        return rank[member.role] >= rank[requiredRole];
    }
}
