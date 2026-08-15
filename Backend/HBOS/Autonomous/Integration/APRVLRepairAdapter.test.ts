import { ProcessAPRVLRepairAdapter } from "./APRVLRepairAdapter";

describe("ProcessAPRVLRepairAdapter", () => {
  it("executes the real APRVL Python runner without granting governance authorization", async () => {
    const adapter = new ProcessAPRVLRepairAdapter("python");
    const evidence = await adapter.execute({
      issueType: "repository-health",
      failureOutput: "",
      rootPath: process.cwd(),
    });

    expect(evidence.authorized).toBe(false);
    expect(evidence.summary).toContain("APRVL");
  }, 30000);
});
