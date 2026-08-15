import { ProcessAPRVLRepairAdapter } from "./APRVLRepairAdapter";

describe("ProcessAPRVLRepairAdapter", () => {
  it("executes the real APRVL Python runner and returns verification evidence", async () => {
    const adapter = new ProcessAPRVLRepairAdapter("python");
    const evidence = await adapter.execute({
      issueType: "repository-health",
      failureOutput: "",
      rootPath: process.cwd(),
    });

    expect(evidence.authorized).toBe(true);
    expect(evidence.summary).toContain("APRVL");
  }, 30000);
});
