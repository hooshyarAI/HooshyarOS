import { Engine } from "../Core/Engine";
import { OrganizationModelEngine } from "./OrganizationModelEngine";
import { UserManagementEngine } from "./UserManagementEngine";

export interface AuthorizationResult {
    subject: string;
    status: "READY" | "BLOCKED";
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
}
