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
    /\bsk-[A-Za-z0-9_-]{12,}\b/i,
    /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/i,
];

const CUSTOMER_DATA_MARKERS: ReadonlyArray<RegExp> = [
    /national\s*id|social\s*security|passport|phone|mobile|email|address/i,
    /iban|bank\s*account|card\s*number|account\s*number/i,
    /customer\s*(name|id|record|data)|tenant\s*(name|id|record|data)/i,
    /financial\s*(statement|ledger|trial\s*balance|transaction|invoice|payroll)/i,
    /personal\s*(data|information)/i,
];

const HIGH_RISK_IDENTIFIER_PATTERNS: ReadonlyArray<RegExp> = [
    /\b[A-Z]{2}\d{2}[A-Z0-9]{10,34}\b/i,
    /\b\d{10,19}\b/,
    /\+?\d[\d\s()-]{8,}\d/,
    /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i,
];

const ALLOWED_CATEGORIES = new Set([
    "DESIGN",
    "ARCHITECTURE",
    "SECURITY",
    "PERFORMANCE",
    "RELIABILITY",
    "REPAIR",
    "PRODUCTIZATION",
]);

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

        if (!ALLOWED_CATEGORIES.has(input.category)) {
            reasons.push("external review category is not governed");
        }

        if (input.decisionId !== input.decisionId.trim() || input.decisionId.length > 128) {
            reasons.push("external review decision id is malformed");
        }

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

        for (const value of fields) {
            if (HIGH_RISK_IDENTIFIER_PATTERNS.some((pattern) => pattern.test(value))) {
                reasons.push("high-risk identifier-like material detected");
                break;
            }
        }

        return {
            allowed: reasons.length === 0,
            reasons,
            sanitized: {
                decisionId: "[OPAQUE_EXTERNAL_REVIEW_ID]",
                category: input.category,
                evidence: input.evidence.map(() => "[SANITIZED_EXTERNAL_REVIEW_EVIDENCE]"),
                alternatives: input.alternatives.map(() => "[SANITIZED_EXTERNAL_REVIEW_ALTERNATIVE]"),
                ...(input.context ? { context: "[SANITIZED_EXTERNAL_REVIEW_CONTEXT]" } : {}),
            },
        };
    }
}
