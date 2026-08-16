import { RuntimeValidationContract } from "./RuntimeValidationContract";

describe("RuntimeValidationContract", () => {
  it("defines the complete runtime gate", () => {
    expect(RuntimeValidationContract.requiredStages()).toEqual([
      "install",
      "launch",
      "process-alive",
      "hbos-ready",
      "backend-reachable",
      "auth-ready",
      "tenant-context",
      "persistence-ready",
      "workflow-ready",
    ]);
  });

  it("fails when any required stage is missing or failed", () => {
    const report = RuntimeValidationContract.evaluate("windows", [
      { stage: "install", passed: true, detail: "installed" },
      { stage: "launch", passed: true, detail: "launched" },
    ]);

    expect(report.passed).toBe(false);
  });

  it("passes only when every required stage has passing evidence", () => {
    const evidence = RuntimeValidationContract.requiredStages().map((stage) => ({
      stage,
      passed: true,
      detail: `${stage}-verified`,
    }));

    expect(RuntimeValidationContract.evaluate("android", evidence).passed).toBe(true);
  });
});
