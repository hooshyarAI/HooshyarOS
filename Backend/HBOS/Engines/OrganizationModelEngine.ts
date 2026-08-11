import { Engine } from "../Core/Engine";
import { UserManagementEngine } from "./UserManagementEngine";

export interface OrganizationRecord {
    name: string;
    status: "READY" | "BLOCKED";
}

/** Canonical Phase 2 organization-model boundary. */
export class OrganizationModelEngine implements Engine {
    name = "OrganizationModelEngine";
    private readonly users = new UserManagementEngine();

    initialize(): void {
        this.users.initialize();
    }

    health(): boolean {
        return this.users.health();
    }

    createOrganization(name: string): OrganizationRecord {
        const value = name?.trim() ?? "";
        return { name: value, status: value && this.health() ? "READY" : "BLOCKED" };
    }
}
