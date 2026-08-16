import { RuntimeValidationEvidenceBuilder } from "./RuntimeValidationEvidence";

describe("RuntimeValidationEvidenceBuilder", () => {
  it("records only explicitly supplied evidence", () => {
    const builder = new RuntimeValidationEvidenceBuilder();
    builder.record("install", true, "installer completed");

    expect(builder.build()).toEqual([
      { stage: "install", passed: true, detail: "installer completed" },
    ]);
  });

  it("rejects empty evidence details", () => {
    const builder = new RuntimeValidationEvidenceBuilder();

    expect(() => builder.record("launch", true, "  ")).toThrow(
      "Runtime evidence detail is required for launch",
    );
  });
});
