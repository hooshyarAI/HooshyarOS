/**
 * Focused tests for the additive assistant conversation-history supporting
 * service. Proves tenant isolation, bounded retention and list/get behaviour.
 * It is a supporting service, not an Engine.
 */
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { AssistantConversationHistory } from "../Product/AssistantConversationHistory";

describe("AssistantConversationHistory (tenant-scoped supporting service)", () => {
    let persistence: SQLitePersistenceStore;
    let clock: number;

    beforeEach(() => {
        clock = 1_900_000_000_000;
        persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    });

    afterEach(() => persistence.close());

    const build = (max = 200) => new AssistantConversationHistory(persistence, () => {
        clock += 1000;
        return clock;
    }, max);

    test("records and lists a tenant's conversations newest-first", async () => {
        const history = build();
        await history.record({ tenantId: "t1", userId: "u1", username: "owner", question: "سؤال اول", answer: "پاسخ اول" });
        await history.record({ tenantId: "t1", userId: "u1", username: "owner", question: "سؤال دوم", answer: "پاسخ دوم" });

        const page = await history.list("t1", 10, 0);
        expect(page.total).toBe(2);
        expect(page.items[0].question).toBe("سؤال دوم");
        expect(page.items[1].question).toBe("سؤال اول");
    });

    test("never returns another tenant's conversation", async () => {
        const history = build();
        const recorded = await history.record({ tenantId: "t1", userId: "u1", username: "owner", question: "q", answer: "a" });

        expect(await history.get("t1", recorded.conversationId)).not.toBeNull();
        expect(await history.get("t2", recorded.conversationId)).toBeNull();
        expect((await history.list("t2", 10, 0)).total).toBe(0);
    });

    test("retains only the most recent N conversations per tenant", async () => {
        const history = build(2);
        await history.record({ tenantId: "t1", userId: "u1", username: "owner", question: "q1", answer: "a1" });
        await history.record({ tenantId: "t1", userId: "u1", username: "owner", question: "q2", answer: "a2" });
        const third = await history.record({ tenantId: "t1", userId: "u1", username: "owner", question: "q3", answer: "a3" });

        const page = await history.list("t1", 10, 0);
        expect(page.total).toBe(2);
        expect(page.items.map((item) => item.question)).toEqual(["q3", "q2"]);
        expect(await history.get("t1", third.conversationId)).not.toBeNull();
    });

    test("supports bounded pagination over the tenant's history", async () => {
        const history = build();
        for (let index = 0; index < 5; index += 1) {
            await history.record({ tenantId: "t1", userId: "u1", username: "owner", question: `q${index}`, answer: `a${index}` });
        }
        const page = await history.list("t1", 2, 2);
        expect(page.total).toBe(5);
        expect(page.items).toHaveLength(2);
        expect(page.items[0].question).toBe("q2");
        expect(page.items[1].question).toBe("q1");
    });
});
