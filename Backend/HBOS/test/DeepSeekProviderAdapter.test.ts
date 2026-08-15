import { DeepSeekProviderAdapter } from "../Architecture/Review/DeepSeekProviderAdapter";

describe("DeepSeekProviderAdapter", () => {
    const review = {
        decisionId: "decision-1",
        risk: "HIGH",
        material: true,
        irreversible: false,
        category: "REPAIR",
        evidence: ["evidence-backed observation"],
        alternatives: ["alternative 1"],
        verdict: "ALLOW_WITH_CONDITIONS",
        findings: [
            {
                id: "finding-1",
                severity: "MEDIUM",
                statement: "Repair must preserve the frozen boundary.",
                evidence: ["architecture-contract"],
                rationale: "The repair crosses a governed component boundary.",
            },
        ],
        recommendation: "Use the narrowest reversible repair.",
        verificationCriteria: ["focused test", "regression test", "clean repository"],
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const request = {
        decisionId: "decision-1",
        risk: "HIGH" as const,
        material: true,
        irreversible: false,
        category: "REPAIR" as const,
        evidence: ["failure-log"],
        alternatives: ["focused-repair", "architectural-repair"],
    };

    it("requires a configured API key", async () => {
        const adapter = new DeepSeekProviderAdapter({ fetchImpl: jest.fn() as typeof fetch });
        await expect(adapter.review(request)).rejects.toThrow("DEEPSEEK_API_KEY is not configured");
    });

    it("submits a useful sanitized technical review request and validates JSON response", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify(review) } }],
        }), { status: 200, headers: { "content-type": "application/json" } }));

        const adapter = new DeepSeekProviderAdapter({
            apiKey: "test-key",
            fetchImpl: fetchImpl as typeof fetch,
            timeoutMs: 2_000,
            maxRetries: 0,
        });

        const result = await adapter.review(request);

        expect(result).toEqual(review);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [, requestInit] = fetchImpl.mock.calls[0] as [string, RequestInit];
        expect(requestInit.method).toBe("POST");
        expect(requestInit.headers).toMatchObject({ Authorization: "Bearer test-key" });
        const body = JSON.parse(String(requestInit.body));
        expect(body.model).toBe("deepseek-v4-pro");
        expect(body.response_format).toEqual({ type: "json_object" });
        expect(body.thinking).toEqual({ type: "enabled" });
        expect(body.reasoning_effort).toBe("high");
        expect(body.messages[1].content).toContain("failure-log");
        expect(body.messages[1].content).toContain("focused-repair");
        expect(body.messages[1].content).not.toContain("[SANITIZED_EXTERNAL_REVIEW_EVIDENCE]");
    });

    it("retries transient provider failures", async () => {
        const fetchImpl = jest.fn()
            .mockResolvedValueOnce(new Response("temporary", { status: 503 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                choices: [{ message: { content: JSON.stringify(review) } }],
            }), { status: 200 }));

        const adapter = new DeepSeekProviderAdapter({
            apiKey: "test-key",
            fetchImpl: fetchImpl as typeof fetch,
            timeoutMs: 2_000,
            maxRetries: 1,
        });

        await expect(adapter.review(request)).resolves.toEqual(review);
        expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("rejects malformed review packets", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ verdict: "ALLOW" }) } }],
        }), { status: 200 }));

        const adapter = new DeepSeekProviderAdapter({
            apiKey: "test-key",
            fetchImpl: fetchImpl as typeof fetch,
            timeoutMs: 2_000,
            maxRetries: 0,
        });

        await expect(adapter.review(request)).rejects.toThrow("invalid adversarial review packet");
    });

    it("rejects a provider packet that changes decision context", async () => {
        const mismatched = { ...review, category: "SECURITY" };
        const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify(mismatched) } }],
        }), { status: 200 }));

        const adapter = new DeepSeekProviderAdapter({
            apiKey: "test-key",
            fetchImpl: fetchImpl as typeof fetch,
            timeoutMs: 2_000,
            maxRetries: 0,
        });

        await expect(adapter.review(request)).rejects.toThrow("mismatched decision context");
    });

    it("rejects provider output that contains sensitive material", async () => {
        const unsafe = {
            ...review,
            recommendation: "Send customer email and bank account details to reproduce the issue.",
        };
        const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify(unsafe) } }],
        }), { status: 200 }));

        const adapter = new DeepSeekProviderAdapter({
            apiKey: "test-key",
            fetchImpl: fetchImpl as typeof fetch,
            timeoutMs: 2_000,
            maxRetries: 0,
        });

        await expect(adapter.review(request)).rejects.toThrow("response blocked by security boundary");
    });
});