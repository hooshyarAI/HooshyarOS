import { SelfHealingOrchestrator } from "./SelfHealingOrchestrator";
import type { APRVLRepairAdapter } from "../Integration/APRVLRepairAdapter";
import { ControlledRepairCapability } from "../Repair/ControlledRepairCapability";

describe("SelfHealingOrchestrator controlled repair E2E", () => {
  it("requires governance, APRVL verification, and controlled repair", async () => {
    const aprvl: APRVLRepairAdapter = {
      execute: jest.fn().mockResolvedValue({
        authorized: true,
        verified: true,
        summary: "failure analyzed and independently verified",
      }),
    };
    const capability = new ControlledRepairCapability();
    const orchestrator = new SelfHealingOrchestrator(aprvl, capability);

    const aprvlEvidence = await orchestrator.heal("controlled failure", {
      authorized: true,
      authorizationToken: "test-token",
    });

    const evidence = await orchestrator.executeAuthorizedRepair(
      aprvlEvidence,
      {
        action: "replace-file",
        path: "Backend/HBOS/Autonomous/Orchestrator/.repair-e2e.tmp",
        expectedSha256: "",
        content: "verified repair artifact\n",
      },
      { authorized: true, authorizationToken: "test-token" },
    );

    expect(aprvl).toBeDefined();
    expect(aprvlEvidence.verified).toBe(true);
    expect(evidence.verified).toBe(true);
    expect(evidence.afterSha256).toBeTruthy();
  });
});
