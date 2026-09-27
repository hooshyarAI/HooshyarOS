/**
 * Runtime HTTP tests for the derived workspace-attention view.
 *
 * Proves reminders and escalations are projected from the canonical governed
 * work items (due dates and BLOCKED status) without adding persistence or a new
 * owner, and that the projection is tenant-isolated.
 */
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

describe("workspace attention (reminders + escalations) — runtime HTTP", () => {
    let server: Server;
    let clock: number;

    beforeEach(async () => {
        clock = 1_900_000_000_000;
        server = createCommercialRuntimeServer({
            databasePath: ":memory:",
            now: () => clock,
            sessionSweepIntervalMs: 0,
            reasoning: { reason: (problem: string) => ({ problem, status: "verified", success: true, answer: "verified" }) },
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

    const driveBlockedWorkItem = async (cookie: string, title: string): Promise<string> => {
        const decision = await jsonPost("/api/decision/workbench", cookie, DECISION_BODY);
        expect(decision.status).toBe(200);
        const proposed = await jsonPost("/api/execution/work-items", cookie, { title });
        const workItemId = (await proposed.json()).workItemId as string;
        await jsonPost(`/api/execution/work-items/${encodeURIComponent(workItemId)}/approve`, cookie, { comments: "approved" });
        await jsonPost(`/api/execution/work-items/${encodeURIComponent(workItemId)}/assign`, cookie, {
            assigneeId: "ops-lead",
            dueDate: "2026-01-01T00:00:00.000Z",
        });
        await jsonPost(`/api/execution/work-items/${encodeURIComponent(workItemId)}/start`, cookie, {});
        const blocked = await jsonPost(`/api/execution/work-items/${encodeURIComponent(workItemId)}/block`, cookie, { reason: "waiting on external approval" });
        expect(blocked.status).toBe(200);
        return workItemId;
    };

    test("projects an overdue reminder and an escalation from governed work items", async () => {
        const cookie = await register("attention-owner", "Attention Org");
        const workItemId = await driveBlockedWorkItem(cookie, "Blocked expansion task");

        const response = await request("/api/execution/attention", { headers: { cookie } });
        expect(response.status).toBe(200);
        const body = await response.json();

        const reminder = body.reminders.find((item: { workItemId: string }) => item.workItemId === workItemId);
        expect(reminder).toBeDefined();
        expect(reminder.bucket).toBe("OVERDUE");
        expect(reminder.dueDate).toBe("2026-01-01T00:00:00.000Z");
        expect(body.counts.overdue).toBeGreaterThanOrEqual(1);

        const escalation = body.escalations.find((item: { workItemId: string }) => item.workItemId === workItemId);
        expect(escalation).toBeDefined();
        expect(escalation.reason).toBe("waiting on external approval");
        expect(body.counts.escalations).toBeGreaterThanOrEqual(1);
    });

    test("keeps the attention view tenant-isolated", async () => {
        const ownerA = await register("attention-a", "Tenant A");
        await driveBlockedWorkItem(ownerA, "Tenant A task");

        const ownerB = await register("attention-b", "Tenant B");
        const response = await request("/api/execution/attention", { headers: { cookie: ownerB } });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.reminders).toHaveLength(0);
        expect(body.escalations).toHaveLength(0);
    });
});
