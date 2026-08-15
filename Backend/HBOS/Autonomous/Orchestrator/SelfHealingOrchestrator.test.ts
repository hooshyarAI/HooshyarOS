import { SelfHealingOrchestrator } from "./SelfHealingOrchestrator";
import type { APRVLRepairAdapter } from "../Integration/APRVLRepairAdapter";

describe("SelfHealingOrchestrator governance boundary", () => {
  it("does not invoke APRVL when repair is unauthorized", async () => {
    const execute = jest.fn();
    const adapter: APRVLRepairAdapter = { execute };
    const orchestrator = new SelfHealingOrchestrator(adapter);

    const evidence = await orchestrator.heal("failure output", { authorized: false });

    expect(execute).not.toHaveBeenCalled();
    expect(evidence.authorized).toBe(false);
    expect(evidence.verified).toBe(false);
  });

  it("invokes APRVL only after governance authorization", async () => {
    const adapter: APRVLRepairAdapter = {
      execute: jest.fn().mockResolvedValue({
        authorized: true,
        verified: true,
        summary: "verified",
      }),
    };
    const orchestrator = new SelfHealingOrchestrator(adapter);

    const evidence = await orchestrator.heal("failure output", { authorized: true });

    expect(adapter.execute).toHaveBeenCalledTimes(1);
    expect(evidence.verified).toBe(true);
  });
});
