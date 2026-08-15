import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ControlledRepairCapability } from "./ControlledRepairCapability";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

describe("ControlledRepairCapability", () => {
  it("executes only an authorized allowlisted replacement and verifies it", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hooshyar-repair-"));
    await writeFile(path.join(root, "target.txt"), "before", "utf8");
    const capability = new ControlledRepairCapability(root);

    const evidence = await capability.execute({
      action: "replace-file",
      relativePath: "target.txt",
      expectedSha256: digest("before"),
      content: "after",
      authorizationToken: "governance-approved",
    });

    expect(evidence.changed).toBe(true);
    expect(evidence.verified).toBe(true);
    expect(await readFile(path.join(root, "target.txt"), "utf8")).toBe("after");
  });

  it("rejects a path escaping the governed root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hooshyar-repair-"));
    const capability = new ControlledRepairCapability(root);

    await expect(capability.execute({
      action: "replace-file",
      relativePath: "../outside.txt",
      expectedSha256: digest("before"),
      content: "after",
      authorizationToken: "governance-approved",
    })).rejects.toThrow("repair path escapes governed root");
  });

  it("rejects stale repair preconditions", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "hooshyar-repair-"));
    await writeFile(path.join(root, "target.txt"), "current", "utf8");
    const capability = new ControlledRepairCapability(root);

    await expect(capability.execute({
      action: "replace-file",
      relativePath: "target.txt",
      expectedSha256: digest("stale"),
      content: "after",
      authorizationToken: "governance-approved",
    })).rejects.toThrow("repair precondition digest mismatch");
  });
});
