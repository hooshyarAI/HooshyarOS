import { DeepSeekProviderAdapter } from "../Architecture/Review/DeepSeekProviderAdapter";

describe("DeepSeekProviderAdapter", () => {
    const review = {
        decisionId: "decision-1",
        risk: "HIGH",
        material: true,
        irreversible: false,
        category: "REPAIR",
        evidence: ["failure-log"],
        alternatives: ["focused-repair", "architectural-repair"],
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

    it("requires a configured API key", async () => {
        const adapter = new DeepSeekProviderAdapter({ fetchImpl: jest.fn() as typeof fetch });
        await expect(adapter.review({
            decisionId: "decision-1",
            risk: "HIGH",
            material: true,
            irreversible: false,
            category: "REPAIR",
            evidence: ["failure-log"],
            alternatives: ["focused-repair"],
        })).rejects.toThrow("DEEPSEEK_API_KEY is not configured");
    });

    it("submits a structured review request and validates JSON response", async () => {
        const fetchImpl = jest.fn().mockResolvedValue(new Response(JSON.stringify({
            choices: [{ message: { content: JSON.stringify(review) } }],
        }), { status: 200, headers: { "content-type": "application/json" } }));

        const adapter = new DeepSeekProviderAdapter({
            apiKey: "test-key",
            fetchImpl: fetchImpl as typeof fetch,
            timeoutMs: 2_000,
            maxRetries: 0,
        });

        const result = await adapter.review({
            decisionId: "decision-1",
            risk: "HIGH",
            material: true,
            irreversible: false,
            category: "REPAIR",
            evidence: ["failure-log"],
            alternatives: ["focused-repair", "architectural-repair"],
            context: "Windows and Android productization failure",
        });

        expect(result).toEqual(review);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [, request] = fetchImpl.mock.calls[0] as [string, RequestInit];
        expect(request.method).toBe("POST");
        expect(request.headers).toMatchObject({ Authorization: "Bearer test-key" });
        const body = JSON.parse(String(request.body));
        expect(body.model).toBe("deepseek-v4-pro");
        expect(body.response_format).toEqual({ type: "json_object" });
        expect(body.thinking).toEqual({ type: "enabled" });
        expect(body.reasoning_effort).toBe("high");
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

        await expect(adapter.review({
            decisionId: "decision-1",
            risk: "HIGH",
            material: true,
            irreversible: false,
            category: "REPAIR",
            evidence: ["failure-log"],
            alternatives: ["focused-repair"],
        })).resolves.toEqual(review);

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

        await expect(adapter.review({
            decisionId: "decision-1",
            risk: "HIGH",
            material: true,
            irreversible: false,
            category: "REPAIR",
            evidence: ["failure-log"],
            alternatives: ["focused-repair"],
        })).rejects.toThrow("invalid adversarial review packet");
    });
});
