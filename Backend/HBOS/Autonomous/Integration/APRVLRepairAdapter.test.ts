import type { APRVLRepairAdapter, APRVLRepairEvidence, APRVLRepairRequest } from "./APRVLRepairAdapter";

describe("APRVLRepairAdapter contract", () => {
  it("requires an authorization boundary in returned evidence", async () => {
    const adapter: APRVLRepairAdapter = {
      async execute(request: APRVLRepairRequest): Promise<APRVLRepairEvidence> {
        expect(request.issueType).toBe("test-failure");
        expect(request.failureOutput).toContain("failure");
        return { authorized: true, verified: true, summary: "verified" };
      },
    };

    const evidence = await adapter.execute({
      issueType: "test-failure",
      failureOutput: "failure: example",
    });

    expect(evidence.authorized).toBe(true);
    expect(evidence.verified).toBe(true);
  });
});
