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
    /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|authorization)\b\s*[:=]\s*[^\s,;]+/i,
    /\bsk-[A-Za-z0-9_-]{12,}\b/i,
    /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/i,
];

const CUSTOMER_DATA_MARKERS: ReadonlyArray<RegExp> = [
    /\b(?:customer|tenant)\s+(?:name|id|record|data)\b/i,
    /\b(?:national\s*id|social\s*security|passport)\b/i,
    /\b(?:iban|bank\s*account|card\s*number|account\s*number)\b/i,
    /\bpersonal\s+(?:data|information)\b/i,
    /\b(?:customer|tenant)\s+(?:email|phone|mobile|address)\s*(?:list|records?|data)?\b/i,
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

const TECHNICAL_SAFE_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]"],
    [/\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|passwd|authorization)\b\s*[:=]\s*[^\s,;]+/gi, "[REDACTED_SECRET]"],
    [/\bsk-[A-Za-z0-9_-]{12,}\b/gi, "[REDACTED_API_TOKEN]"],
    [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gi, "[REDACTED_JWT]"],
    [/\b[A-Z]{2}\d{2}[A-Z0-9]{10,34}\b/gi, "[REDACTED_IDENTIFIER]"],
];

function sanitizeTechnicalText(value: string): string {
    let sanitized = value;
    for (const [pattern, replacement] of TECHNICAL_SAFE_REPLACEMENTS) {
        sanitized = sanitized.replace(pattern, replacement);
    }
    sanitized = sanitized.replace(/\b\d{10,19}\b/g, "[REDACTED_IDENTIFIER]");
    sanitized = sanitized.replace(/\+?\d[\d\s()-]{8,}\d/g, "[REDACTED_PHONE]");
    sanitized = sanitized.replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi, "[REDACTED_EMAIL]");
    return sanitized;
}

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

        if (fields.some((value) => CUSTOMER_DATA_MARKERS.some((pattern) => pattern.test(value)))) {
            reasons.push("customer-sensitive data marker detected");
        }

        return {
            allowed: reasons.length === 0,
            reasons,
            sanitized: {
                decisionId: sanitizeTechnicalText(input.decisionId),
                category: input.category,
                evidence: input.evidence.map(sanitizeTechnicalText),
                alternatives: input.alternatives.map(sanitizeTechnicalText),
                ...(input.context ? { context: sanitizeTechnicalText(input.context) } : {}),
            },
        };
    }
}
