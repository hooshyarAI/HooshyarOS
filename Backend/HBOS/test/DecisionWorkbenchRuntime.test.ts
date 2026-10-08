import { Server } from "node:http";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const DECISION_BODY = {
    problem: "choose expansion plan",
    alternatives: ["Alpha", "Beta"],
    criteria: [
        { name: "profit", weight: 0.6, direction: "benefit" },
        { name: "risk", weight: 0.4, direction: "cost" },
    ],
    scores: [
        [8, 4],
        [6, 3],
    ],
};

const request = async (server: Server, path: string, options: RequestInit = {}) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server-not-listening");
    return fetch(`http://127.0.0.1:${address.port}${path}`, options);
};

const cookieFrom = (response: Response): string => {
    const cookie = response.headers.get("set-cookie");
    if (!cookie) throw new Error("session-cookie-missing");
    return cookie.split(";")[0];
};

describe("product.decision-workbench — commercial runtime path", () => {
    let server: Server;

    beforeEach(async () => {
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified" }) },
        });
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    });

    afterEach(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    const register = (username: string, organization: string) =>
        request(server, "/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
        });

    const postDecision = (cookie: string, body: unknown = DECISION_BODY) =>
        request(server, "/api/decision/workbench", {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify(body),
        });

    test("evaluates a decision and exposes it through tenant-scoped latest retrieval", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const decision = await postDecision(cookie);
        expect(decision.status).toBe(200);
        const body = await decision.json();
        expect(body.status).toBe("READY");
        expect(body.capabilityId).toBe("product.decision-workbench");
        expect(body.targetEngine).toBe("Decision Intelligence Engine");
        expect(body.recommendation.alternative).toBe("Alpha");
        expect(body.evaluations).toHaveLength(2);
        expect(Array.isArray(body.limitations)).toBe(true);

        const latest = await request(server, "/api/decision/latest", { headers: { cookie } });
        expect(latest.status).toBe(200);
        const latestBody = await latest.json();
        expect(latestBody.recommendation.alternative).toBe("Alpha");
        expect(latestBody.tenantId).toBe(body.tenantId);
    });

    test("supports the AHP pairwise matrix weights source", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const decision = await postDecision(cookie, {
            ...DECISION_BODY,
            pairwiseMatrix: [
                [1, 3],
                [1 / 3, 1],
            ],
        });
        expect(decision.status).toBe(200);
        const body = await decision.json();
        expect(body.weightsSource).toBe("AHP");
        expect(body.consistency.consistent).toBe(true);
        expect(body.weights[0]).toBeCloseTo(0.75, 6);
    });

    test("RBAC denies decision creation for a viewer and unauthenticated callers", async () => {
        await register("owner", "Acme");
        const viewer = await register("viewer", "Acme");
        const viewerCookie = cookieFrom(viewer);

        const viewerDecision = await postDecision(viewerCookie);
        expect(viewerDecision.status).toBe(403);
        expect((await viewerDecision.json()).error).toBe("INSUFFICIENT_PERMISSIONS");

        const anonymous = await request(server, "/api/decision/workbench", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(DECISION_BODY),
        });
        expect(anonymous.status).toBe(401);
    });

    test("keeps the latest decision tenant-scoped", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);
        const decision = await postDecision(cookie);
        expect(decision.status).toBe(200);

        const other = await register("other-owner", "Other");
        const otherCookie = cookieFrom(other);
        const otherLatest = await request(server, "/api/decision/latest", { headers: { cookie: otherCookie } });
        expect(otherLatest.status).toBe(404);
        expect((await otherLatest.json()).error).toBe("DECISION_NOT_FOUND");
    });

    test("fails closed on malformed decision payloads", async () => {
        const owner = await register("owner", "Acme");
        const cookie = cookieFrom(owner);

        const missingProblem = await postDecision(cookie, { ...DECISION_BODY, problem: "" });
        expect(missingProblem.status).toBe(400);
        expect((await missingProblem.json()).error).toBe("DECISION_PROBLEM_REQUIRED");

        const oneAlternative = await postDecision(cookie, { ...DECISION_BODY, alternatives: ["Only"] });
        expect(oneAlternative.status).toBe(400);
        expect((await oneAlternative.json()).error).toBe("DECISION_ALTERNATIVES_REQUIRED");

        const badCriteria = await postDecision(cookie, {
            ...DECISION_BODY,
            criteria: [{ name: "profit", weight: 0, direction: "benefit" }],
        });
        expect(badCriteria.status).toBe(400);
        expect((await badCriteria.json()).error).toBe("DECISION_CRITERIA_REQUIRED");

        const badScores = await postDecision(cookie, { ...DECISION_BODY, scores: [[8, 4]] });
        expect(badScores.status).toBe(400);
        expect((await badScores.json()).error).toBe("DECISION_SCORES_REQUIRED");

        const persisted = await request(server, "/api/decision/latest", { headers: { cookie } });
        expect(persisted.status).toBe(404);
    });
});
