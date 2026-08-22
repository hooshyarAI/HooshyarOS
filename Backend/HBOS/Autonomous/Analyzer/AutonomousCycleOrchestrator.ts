import { calculateRisk, RiskInput } from "./AutonomousRiskEngine";
import { dependenciesSatisfied, DependencyInput } from "./DependencyResolutionGate";
import { authorizeExecution, ExecutionAuthorizationInput } from "./ExecutionAuthorizationGate";
import { verificationPassed, VerificationState } from "./VerificationGate";
import { commercialReady, CommercialReadinessInput } from "./CommercialReadinessGate";
import { customerAccessAllowed, CustomerAccessInput } from "./CustomerPrivacyGate";
import { lineageComplete, DataLineageInput } from "./DataLineageGate";
import { trialAllowed, CustomerTrialInput } from "./CustomerTrialGate";

export interface AutonomousCycleInput {
    risk: RiskInput;
    dependencies: DependencyInput;
    authorization: ExecutionAuthorizationInput;
    verification: VerificationState;
    commercial: CommercialReadinessInput;
    privacy: CustomerAccessInput;
    lineage: DataLineageInput;
    trial: CustomerTrialInput;
}

export interface AutonomousCycleResult {
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    executable: boolean;
    trialAllowed: boolean;
}

export function evaluateAutonomousCycle(input: AutonomousCycleInput): AutonomousCycleResult {
    const risk = calculateRisk(input.risk);
    const deps = dependenciesSatisfied(input.dependencies);
    const verified = verificationPassed(input.verification);
    const privacy = customerAccessAllowed(input.privacy);
    const lineage = lineageComplete(input.lineage);
    const commercial = commercialReady(input.commercial);
    const authorized = authorizeExecution({ ...input.authorization, dependenciesSatisfied: deps });
    const trial = trialAllowed({ ...input.trial, commercialReady: commercial, dataBoundaryVerified: privacy && lineage });

    return {
        riskLevel: risk.level,
        executable: authorized && verified && privacy && lineage,
        trialAllowed: trial,
    };
}
