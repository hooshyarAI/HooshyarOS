import { CommercialOfflineOnlineService } from "./CommercialOfflineOnlineService";

describe("Commercial offline-online integration", () => {
  test("replays tenant operations through the online delivery boundary", () => {
    const service = new CommercialOfflineOnlineService();
    const received: Array<{ tenantId: string; type: string }> = [];
    service.setOnline(false);
    service.submit({ id: "op-1", tenantId: "tenant-offline", type: "FINANCIAL_INGEST", payload: { amount: 100 } }, op => received.push({ tenantId: op.tenantId, type: op.type }));
    service.setOnline(true);
    const replay = service.replay(op => received.push({ tenantId: op.tenantId, type: op.type }));

    expect(replay).toEqual({ replayed: 1, remaining: 0 });
    expect(received).toEqual([{ tenantId: "tenant-offline", type: "FINANCIAL_INGEST" }]);
  });
});
