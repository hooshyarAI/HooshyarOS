export type ExternalDependencyStatus = "READY" | "BLOCKED";

export interface ExternalDependencyEvidence {
    id: "payment-provider-activation" | "production-cloud-resources";
    status: ExternalDependencyStatus;
    evidence: string;
}

/**
 * Repository-native boundary for dependencies that cannot honestly be inferred
 * from source-code presence. Readiness is opt-in and must be backed by explicit
 * operator evidence; no secret value is ever returned or logged.
 */
export class ExternalProductionDependencyAudit {
    audit(env: NodeJS.ProcessEnv = process.env): ExternalDependencyEvidence[] {
        return [
            this.payment(env),
            this.cloud(env)
        ];
    }

    private payment(env: NodeJS.ProcessEnv): ExternalDependencyEvidence {
        const activated = env.HOOSHYAR_PAYMENT_PROVIDER_ACTIVATED === "1";
        const healthUrl = env.HOOSHYAR_PAYMENT_PROVIDER_HEALTH_URL;
        if (!activated) {
            return {
                id: "payment-provider-activation",
                status: "BLOCKED",
                evidence: healthUrl ? "activation-flag-missing" : "provider-activation-evidence-missing"
            };
        }
        return {
            id: "payment-provider-activation",
            status: "READY",
            evidence: healthUrl ? "explicit-activation-and-health-endpoint-configured" : "explicit-activation-configured"
        };
    }

    private cloud(env: NodeJS.ProcessEnv): ExternalDependencyEvidence {
        const ready = env.HOOSHYAR_PRODUCTION_CLOUD_READY === "1";
        const healthUrl = env.HOOSHYAR_PRODUCTION_HEALTH_URL;
        if (!ready) {
            return {
                id: "production-cloud-resources",
                status: "BLOCKED",
                evidence: healthUrl ? "cloud-ready-flag-missing" : "production-cloud-readiness-evidence-missing"
            };
        }
        return {
            id: "production-cloud-resources",
            status: "READY",
            evidence: healthUrl ? "explicit-cloud-readiness-and-health-endpoint-configured" : "explicit-cloud-readiness-configured"
        };
    }
}
