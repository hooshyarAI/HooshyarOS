import { WindowsRuntimeProbe } from "./WindowsRuntimeProbe";

describe("WindowsRuntimeProbe", () => {
  it("produces explicit passing evidence when the executable responds", () => {
    const probe = new WindowsRuntimeProbe({
      executable: process.execPath,
    });

    const evidence = probe.probe();

    expect(evidence).toHaveLength(1);
    expect(evidence[0].stage).toBe("process-alive");
    expect(evidence[0].passed).toBe(true);
  });
});
