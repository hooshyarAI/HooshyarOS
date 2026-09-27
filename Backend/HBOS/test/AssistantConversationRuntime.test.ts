/**
 * Runtime HTTP tests for assistant conversation continuity.
 *
 * Proves `/api/assistant` records a tenant-scoped conversation, that
 * `/api/conversations` lists and retrieves it, and that a second tenant can
 * neither list nor fetch the first tenant's conversation.
 */
import { readFileSync } from "node:fs";
import { Server } from "node:http";
import { resolve } from "node:path";
import { createCommercialRuntimeServer } from "../Autonomous/Runtime/CommercialRuntimeServer";

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const XLS_REPORT = resolve(REPO_ROOT, "Backend", "HBOS", "test", "fixtures", "synthetic", "financial_report_1402.xls");

describe("assistant conversation continuity — runtime HTTP", () => {
    let server: Server;
    let clock: number;

    beforeEach(async () => {
        clock = 1_900_000_000_000;
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            now: () => clock,
            sessionSweepIntervalMs: 0,
            reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified-answer" }) },
        });
        await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", () => resolveListen()));
    });

    afterEach(async () => {
        await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    });

    const request = async (path: string, options: RequestInit = {}): Promise<Response> => {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("server-not-listening");
        return fetch(`http://127.0.0.1:${address.port}${path}`, options);
    };

    const jsonPost = (path: string, cookie: string, body: unknown) => {
        clock += 1000;
        return request(path, {
            method: "POST",
            headers: { "content-type": "application/json", cookie },
            body: JSON.stringify(body),
        });
    };

    const register = async (username: string, organization: string): Promise<string> => {
        const response = await request("/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username, password: "Sup3rSecret!", organization }),
        });
        const cookie = response.headers.get("set-cookie");
        if (!cookie) throw new Error("session-cookie-missing");
        return cookie.split(";")[0];
    };

    const prepareAnalysis = async (cookie: string): Promise<void> => {
        const bytes = readFileSync(XLS_REPORT);
        const ingested = await jsonPost("/api/ingest", cookie, {
            sourceName: "financial_report_1402.xls",
            format: "XLS",
            contentBase64: bytes.toString("base64"),
        });
        const sha256 = (await ingested.json()).evidence.sha256;
        const analysis = await jsonPost("/api/financial/analyze", cookie, { sourceSha256: sha256 });
        expect(analysis.status).toBe(200);
    };

    test("records an assistant turn and exposes it through the conversation history", async () => {
        const cookie = await register("conv-owner", "Conversation Org");
        await prepareAnalysis(cookie);

        const assistant = await jsonPost("/api/assistant", cookie, { question: "وضعیت سود چیست؟" });
        expect(assistant.status).toBe(200);
        const assistantBody = await assistant.json();
        expect(typeof assistantBody.conversationId).toBe("string");

        const list = await request("/api/conversations", { headers: { cookie } });
        expect(list.status).toBe(200);
        const listBody = await list.json();
        expect(listBody.conversations).toHaveLength(1);
        expect(listBody.conversations[0].question).toBe("وضعیت سود چیست؟");
        expect(listBody.pagination.total).toBe(1);

        const single = await request(`/api/conversations/${encodeURIComponent(assistantBody.conversationId)}`, { headers: { cookie } });
        expect(single.status).toBe(200);
        // The durable conversation records exactly the answer the user received
        // (a question-specific composed answer for a governed statement source).
        expect((await single.json()).answer).toBe(assistantBody.answer);
    });

    test("isolates conversation history per tenant", async () => {
        const ownerA = await register("conv-a", "Tenant A");
        await prepareAnalysis(ownerA);
        const assistant = await jsonPost("/api/assistant", ownerA, { question: "پرسش تنانت الف" });
        const conversationId = (await assistant.json()).conversationId;

        const ownerB = await register("conv-b", "Tenant B");
        const listB = await request("/api/conversations", { headers: { cookie: ownerB } });
        expect(listB.status).toBe(200);
        expect((await listB.json()).conversations).toHaveLength(0);

        const crossTenant = await request(`/api/conversations/${encodeURIComponent(conversationId)}`, { headers: { cookie: ownerB } });
        expect(crossTenant.status).toBe(404);
    });

    test("rejects an invalid pagination bound rather than clamping", async () => {
        const cookie = await register("conv-page", "Page Org");
        const response = await request("/api/conversations?limit=9999", { headers: { cookie } });
        expect(response.status).toBe(400);
        expect((await response.json()).error).toBe("PAGINATION_LIMIT_EXCEEDED");
    });
});
