import { SelfHealingOrchestrator } from "./SelfHealingOrchestrator";
import type { APRVLRepairAdapter } from "../Integration/APRVLRepairAdapter";
import { ControlledRepairCapability } from "../Repair/ControlledRepairCapability";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

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

  it("requires APRVL verification before controlled repair", async () => {
    const adapter: APRVLRepairAdapter = { execute: jest.fn() };
    const root = await mkdtemp(path.join(tmpdir(), "hooshyar-aprvl-"));
    await writeFile(path.join(root, "target.txt"), "before", "utf8");
    const capability = new ControlledRepairCapability(root);
    const orchestrator = new SelfHealingOrchestrator(adapter, capability);
    const expectedSha256 = createHash("sha256").update("before", "utf8").digest("hex");

    await expect(orchestrator.executeAuthorizedRepair(
      { authorized: false, verified: false, summary: "not verified" },
      { action: "replace-file", relativePath: "target.txt", expectedSha256, content: "after" },
      { authorized: true, authorizationToken: "governance-token" },
    )).rejects.toThrow("independent APRVL verification required before repair");

    expect(await readFile(path.join(root, "target.txt"), "utf8")).toBe("before");
  });

  it("executes controlled repair only after governance and APRVL verification", async () => {
    const adapter: APRVLRepairAdapter = {
      execute: jest.fn().mockResolvedValue({ authorized: false, verified: true, summary: "verified" }),
    };
    const root = await mkdtemp(path.join(tmpdir(), "hooshyar-aprvl-"));
    await writeFile(path.join(root, "target.txt"), "before", "utf8");
    const capability = new ControlledRepairCapability(root);
    const orchestrator = new SelfHealingOrchestrator(adapter, capability);
    const aprvlEvidence = await orchestrator.heal("failure output", { authorized: true, authorizationToken: "governance-token" });
    const expectedSha256 = createHash("sha256").update("before", "utf8").digest("hex");

    const evidence = await orchestrator.executeAuthorizedRepair(
      aprvlEvidence,
      { action: "replace-file", relativePath: "target.txt", expectedSha256, content: "after" },
      { authorized: true, authorizationToken: "governance-token" },
    );

    expect(evidence.verified).toBe(true);
    expect(await readFile(path.join(root, "target.txt"), "utf8")).toBe("after");
  });
});
