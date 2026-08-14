import type {
    DeepSeekReviewFinding,
    DeepSeekReviewInput,
    DeepSeekReviewRisk,
    DeepSeekReviewVerdict,
} from "./DeepSeekAdversarialReviewGate";
import { ExternalReviewSecurityBoundary } from "./ExternalReviewSecurityBoundary";

export interface DeepSeekProviderOptions {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    timeoutMs?: number;
    maxRetries?: number;
    fetchImpl?: typeof fetch;
}

export interface DeepSeekReviewRequest {
    decisionId: string;
    risk: DeepSeekReviewRisk;
    material: boolean;
    irreversible: boolean;
    category: DeepSeekReviewInput["category"];
    evidence: string[];
    alternatives: string[];
    context?: string;
}

interface DeepSeekApiResponse {
    choices?: Array<{
        message?: {
            content?: string | null;
        };
    }>;
}

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-v4-pro";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_RETRIES = 2;

export class DeepSeekProviderAdapter {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly model: string;
    private readonly timeoutMs: number;
    private readonly maxRetries: number;
    private readonly fetchImpl: typeof fetch;
    private readonly securityBoundary: ExternalReviewSecurityBoundary;

    constructor(options: DeepSeekProviderOptions = {}) {
        this.apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
        this.baseUrl = (options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
        this.model = options.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
        this.timeoutMs = options.timeoutMs ?? Number(process.env.DEEPSEEK_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
        this.maxRetries = options.maxRetries ?? Number(process.env.DEEPSEEK_MAX_RETRIES ?? DEFAULT_MAX_RETRIES);
        this.fetchImpl = options.fetchImpl ?? fetch;
        this.securityBoundary = new ExternalReviewSecurityBoundary();
    }

    isConfigured(): boolean {
        return this.apiKey.trim().length > 0;
    }

    async review(request: DeepSeekReviewRequest): Promise<DeepSeekReviewInput> {
        if (!this.isConfigured()) {
            throw new Error("DEEPSEEK_API_KEY is not configured");
        }

        const security = this.securityBoundary.evaluate({
            decisionId: request.decisionId,
            category: request.category,
            evidence: request.evidence,
            alternatives: request.alternatives,
            context: request.context,
        });
        if (!security.allowed) {
            throw new Error(`external review blocked by security boundary: ${security.reasons.join("; ")}`);
        }

        const safeRequest: DeepSeekReviewRequest = {
            ...request,
            decisionId: security.sanitized.decisionId,
            category: this.toReviewCategory(security.sanitized.category),
            evidence: security.sanitized.evidence,
            alternatives: security.sanitized.alternatives,
            ...(security.sanitized.context ? { context: security.sanitized.context } : {}),
        };

        const prompt = this.buildPrompt(safeRequest);
        const response = await this.requestWithRetry(prompt);
        return this.parseReview(response, safeRequest);
    }

    private toReviewCategory(category: string): DeepSeekReviewRequest["category"] {
        if (!this.isCategory(category)) {
            throw new Error("external review security boundary returned an invalid governed category");
        }
        return category;
    }

    private buildPrompt(request: DeepSeekReviewRequest): string {
        return [
            "Act as the independent senior architecture, design, performance, reliability, security and repair critic for HooshyarOS.",
            "Do not implement changes. Challenge assumptions, identify root-cause risks, propose alternatives and issue a governed verdict.",
            "Security boundary: the request is deliberately sanitized. Do not ask for customer records, personal data, financial records, credentials, tokens, secrets or raw business documents.",
            "Return ONLY valid JSON matching this shape:",
            JSON.stringify({
                decisionId: request.decisionId,
                risk: request.risk,
                material: request.material,
                irreversible: request.irreversible,
                category: request.category,
                evidence: ["evidence-backed observation"],
                alternatives: ["alternative 1"],
                verdict: "ALLOW",
                findings: [{ id: "finding-1", severity: "LOW", statement: "...", evidence: ["..."], rationale: "..." }],
                recommendation: "...",
                verificationCriteria: ["..."],
            }),
            `Decision: ${request.decisionId}`,
            `Context: ${request.context ?? "not provided"}`,
            `Risk: ${request.risk}`,
            `Material: ${request.material}`,
            `Irreversible: ${request.irreversible}`,
            `Category: ${request.category}`,
            `Existing evidence: ${JSON.stringify(request.evidence)}`,
            `Candidate alternatives: ${JSON.stringify(request.alternatives)}`,
            "Be adversarial but evidence-based. If evidence is insufficient, say so and use BLOCK rather than inventing facts.",
        ].join("\n");
    }

    private async requestWithRetry(prompt: string): Promise<DeepSeekApiResponse> {
        let lastError: unknown;

        for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);

            try {
                const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: this.model,
                        messages: [
                            { role: "system", content: "You are the independent DeepSeek adversarial review plane for HooshyarOS." },
                            { role: "user", content: prompt },
                        ],
                        thinking: { type: "enabled" },
                        reasoning_effort: "high",
                        response_format: { type: "json_object" },
                        stream: false,
                    }),
                    signal: controller.signal,
                });

                if (response.ok) {
                    return (await response.json()) as DeepSeekApiResponse;
                }

                const body = await response.text();
                if (!this.isRetryableStatus(response.status)) {
                    throw new Error(`DeepSeek API rejected request (${response.status}): ${body.slice(0, 500)}`);
                }
                lastError = new Error(`DeepSeek API transient failure (${response.status})`);
            } catch (error) {
                lastError = error;
                if (error instanceof Error && !this.isRetryableError(error)) {
                    throw error;
                }
            } finally {
                clearTimeout(timer);
            }

            if (attempt < this.maxRetries) {
                await this.sleep(250 * 2 ** attempt);
            }
        }

        throw lastError instanceof Error ? lastError : new Error("DeepSeek request failed");
    }

    private parseReview(response: DeepSeekApiResponse, expected: DeepSeekReviewRequest): DeepSeekReviewInput {
        const content = response.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.trim().length === 0) {
            throw new Error("DeepSeek response did not contain review JSON");
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(content);
        } catch (error) {
            throw new Error(`DeepSeek returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }

        if (!this.isReviewInput(parsed)) {
            throw new Error("DeepSeek returned an invalid adversarial review packet");
        }

        const review = parsed as DeepSeekReviewInput;
        if (
            review.decisionId !== expected.decisionId ||
            review.category !== expected.category ||
            review.risk !== expected.risk ||
            review.material !== expected.material ||
            review.irreversible !== expected.irreversible
        ) {
            throw new Error("DeepSeek returned a review packet with mismatched decision context");
        }

        const responseSecurity = this.securityBoundary.evaluate({
            decisionId: review.decisionId,
            category: review.category,
            evidence: [
                ...review.evidence,
                review.recommendation,
                ...review.verificationCriteria,
                ...review.findings.flatMap((finding) => [
                    finding.id,
                    finding.statement,
                    finding.rationale,
                    ...finding.evidence,
                ]),
            ],
            alternatives: review.alternatives,
        });

        if (!responseSecurity.allowed) {
            throw new Error(`DeepSeek response blocked by security boundary: ${responseSecurity.reasons.join("; ")}`);
        }

        return review;
    }

    private isReviewInput(value: unknown): value is DeepSeekReviewInput {
        if (!value || typeof value !== "object") return false;
        const candidate = value as Record<string, unknown>;
        const findings = candidate.findings;
        const evidence = candidate.evidence;
        const alternatives = candidate.alternatives;
        const verificationCriteria = candidate.verificationCriteria;

        if (
            typeof candidate.decisionId !== "string" ||
            !this.isRisk(candidate.risk) ||
            typeof candidate.material !== "boolean" ||
            typeof candidate.irreversible !== "boolean" ||
            !this.isCategory(candidate.category) ||
            !this.isVerdict(candidate.verdict) ||
            !Array.isArray(evidence) ||
            !Array.isArray(alternatives) ||
            !Array.isArray(verificationCriteria) ||
            !Array.isArray(findings) ||
            typeof candidate.recommendation !== "string"
        ) {
            return false;
        }

        return evidence.every((item) => typeof item === "string")
            && alternatives.every((item) => typeof item === "string")
            && verificationCriteria.every((item) => typeof item === "string")
            && findings.every((finding) => this.isFinding(finding));
    }

    private isFinding(value: unknown): value is DeepSeekReviewFinding {
        if (!value || typeof value !== "object") return false;
        const finding = value as Record<string, unknown>;
        return typeof finding.id === "string"
            && this.isRisk(finding.severity)
            && typeof finding.statement === "string"
            && Array.isArray(finding.evidence)
            && finding.evidence.every((item) => typeof item === "string")
            && typeof finding.rationale === "string";
    }

    private isRisk(value: unknown): value is DeepSeekReviewRisk {
        return value === "LOW" || value === "MEDIUM" || value === "HIGH" || value === "CRITICAL";
    }

    private isVerdict(value: unknown): value is DeepSeekReviewVerdict {
        return value === "ALLOW" || value === "ALLOW_WITH_CONDITIONS" || value === "BLOCK";
    }

    private isCategory(value: unknown): value is DeepSeekReviewInput["category"] {
        return value === "ARCHITECTURE"
            || value === "DESIGN"
            || value === "PERFORMANCE"
            || value === "SECURITY"
            || value === "RELIABILITY"
            || value === "PRODUCTIZATION"
            || value === "REPAIR";
    }

    private isRetryableStatus(status: number): boolean {
        return status === 408 || status === 429 || status >= 500;
    }

    private isRetryableError(error: Error): boolean {
        return error.name === "AbortError" || /network|fetch|timeout|ECONN|ETIMEDOUT/i.test(error.message);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
