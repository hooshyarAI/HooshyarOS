import { Engine } from "../Core/Engine";

export interface DeploymentContractInput {
    target: "local" | "staging" | "production";
    artifact: string;
    healthCheck: string;
    rollback: string;
}

export interface DeploymentContractResult {
    valid: boolean;
    missing: string[];
}

/** Deterministic deployment contract validator; performs no external deployment. */
export class DeploymentContractEngine implements Engine {
    name = "DeploymentContractEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    validate(input: Partial<DeploymentContractInput>): DeploymentContractResult {
        const missing: string[] = [];
        if (!input.target) missing.push("target");
        if (!input.artifact) missing.push("artifact");
        if (!input.healthCheck) missing.push("healthCheck");
        if (!input.rollback) missing.push("rollback");
        return { valid: missing.length === 0, missing };
    }
}
