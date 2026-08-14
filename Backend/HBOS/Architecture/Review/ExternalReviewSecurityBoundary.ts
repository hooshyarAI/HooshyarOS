export interface ExternalReviewSecurityInput {
    decisionId: string;
    category: string;
    evidence: string[];
    alternatives: string[];
    context?: string;
}

export interface ExternalReviewSecurityResult {
    allowed: boolean;
    reasons: string[];
    sanitized: ExternalReviewSecurityInput;
}

const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|authorization)\b\s*[:=]/i,
    /\bsk-[A-Za-z0-9_-]{12,}\b/,
];

const CUSTOMER_DATA_MARKERS: ReadonlyArray<RegExp> = [
    /national\s*id|social\s*security|passport|phone|mobile|email|address/i,
    /iban|bank\s*account|card\s*number|account\s*number/i,
    /customer\s*(name|id|record|data)|tenant\s*(name|id|record|data)/i,
    /financial\s*(statement|ledger|trial\s*balance|transaction|invoice|payroll)/i,
    /personal\s*(data|information)/i,
];

export class ExternalReviewSecurityBoundary {
    evaluate(input: ExternalReviewSecurityInput): ExternalReviewSecurityResult {
        const reasons: string[] = [];
        const fields = [
            input.decisionId,
            input.category,
            input.context ?? "",
            ...input.evidence,
            ...input.alternatives,
        ];

        for (const value of fields) {
            if (SECRET_PATTERNS.some((pattern) => pattern.test(value))) {
                reasons.push("secret-or-credential-like material detected");
                break;
            }
        }

        for (const value of fields) {
            if (CUSTOMER_DATA_MARKERS.some((pattern) => pattern.test(value))) {
                reasons.push("customer-sensitive data marker detected");
                break;
            }
        }

        return {
            allowed: reasons.length === 0,
            reasons,
            sanitized: {
                decisionId: input.decisionId,
                category: input.category,
                evidence: input.evidence.map(() => "[SANITIZED_EXTERNAL_REVIEW_EVIDENCE]"),
                alternatives: input.alternatives.map((value) => value),
                ...(input.context ? { context: "[SANITIZED_EXTERNAL_REVIEW_CONTEXT]" } : {}),
            },
        };
    }
}
