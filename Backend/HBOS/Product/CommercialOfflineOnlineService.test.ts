import { CommercialOfflineOnlineService } from "./CommercialOfflineOnlineService";

describe("CommercialOfflineOnlineService", () => {
  test("queues while offline and replays in order after reconnect", () => {
    const service = new CommercialOfflineOnlineService();
    const delivered: string[] = [];
    service.setOnline(false);

    expect(service.submit({ id: "1", tenantId: "tenant", type: "INGEST", payload: { row: 1 } }, op => delivered.push(op.id))).toBe("QUEUED");
    expect(service.submit({ id: "2", tenantId: "tenant", type: "INGEST", payload: { row: 2 } }, op => delivered.push(op.id))).toBe("QUEUED");
    expect(service.pendingCount()).toBe(2);

    service.setOnline(true);
    expect(service.replay(op => delivered.push(op.id))).toEqual({ replayed: 2, remaining: 0 });
    expect(delivered).toEqual(["1", "2"]);
  });
});
