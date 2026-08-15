import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SelfHealingOrchestrator } from "./SelfHealingOrchestrator";
import type { APRVLRepairAdapter } from "../Integration/APRVLRepairAdapter";
import { ControlledRepairCapability } from "../Repair/ControlledRepairCapability";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

describe("SelfHealingOrchestrator controlled repair E2E", () => {
  it("requires governance, APRVL verification, and controlled repair", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hooshyar-e2e-repair-"));
    const relativePath = "target.txt";
    const before = "before\n";
    const after = "verified repair artifact\n";
    await writeFile(path.join(root, relativePath), before, "utf8");

    const aprvl: APRVLRepairAdapter = {
      execute: jest.fn().mockResolvedValue({
        authorized: true,
        verified: true,
        summary: "failure analyzed and independently verified",
      }),
    };
    const capability = new ControlledRepairCapability(root);
    const orchestrator = new SelfHealingOrchestrator(aprvl, capability);

    const authorization = { authorized: true, authorizationToken: "test-token" };
    const aprvlEvidence = await orchestrator.heal("controlled failure", authorization);
    const evidence = await orchestrator.executeAuthorizedRepair(
      aprvlEvidence,
      {
        action: "replace-file",
        relativePath,
        expectedSha256: digest(before),
        content: after,
      },
      authorization,
    );

    expect(aprvlEvidence.verified).toBe(true);
    expect(evidence.changed).toBe(true);
    expect(evidence.verified).toBe(true);
    expect(evidence.digest).toBe(digest(after));
    expect(await readFile(path.join(root, relativePath), "utf8")).toBe(after);
  });
});
