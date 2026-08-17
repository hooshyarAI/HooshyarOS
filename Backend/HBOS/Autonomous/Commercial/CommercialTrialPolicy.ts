export type TrialDuration = 30 | 60 | 90;

export type TrialExtensionReason =
    | "VALUE_VALIDATION_INCOMPLETE"
    | "INTEGRATION_COMPLEXITY"
    | "PILOT_SCOPE_EXPANSION";

export interface TrialPolicyInput {
    initialDays?: TrialDuration;
    extensionReason?: TrialExtensionReason;
    customerCooperation?: boolean;
}

export interface TrialPolicyResult {
    durationDays: TrialDuration;
    free: true;
    extensionAllowed: boolean;
    reason: TrialExtensionReason | null;
}

/**
 * Trial is a controlled proof-of-value period, not unrestricted free usage.
 */
export class CommercialTrialPolicy {
    evaluate(input: TrialPolicyInput = {}): TrialPolicyResult {
        const initialDays: TrialDuration = input.initialDays ?? 30;
        const reason = input.extensionReason ?? null;
        const extensionAllowed = reason !== null && input.customerCooperation === true;

        if (!extensionAllowed) {
            return {
                durationDays: initialDays,
                free: true,
                extensionAllowed: false,
                reason,
            };
        }

        const durationDays: TrialDuration = initialDays === 30 ? 60 : 90;
        return {
            durationDays,
            free: true,
            extensionAllowed: true,
            reason,
        };
    }
}
