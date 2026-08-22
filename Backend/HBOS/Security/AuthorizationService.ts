export interface AuthorizationIdentity {
    userId: string;
    roles: string[];
}

export interface AuthorizationPolicy {
    rolePermissions: Record<string, string[]>;
}

export class AuthorizationService {
    constructor(private readonly policy: AuthorizationPolicy) {}

    isAllowed(identity: AuthorizationIdentity, permission: string): boolean {
        if (!identity.userId || !permission) return false;
        return identity.roles.some((role) => this.policy.rolePermissions[role]?.includes(permission) === true);
    }

    require(identity: AuthorizationIdentity, permission: string): void {
        if (!this.isAllowed(identity, permission)) {
            throw new Error("Authorization denied");
        }
    }
}
