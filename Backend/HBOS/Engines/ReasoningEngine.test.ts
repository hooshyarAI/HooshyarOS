import { ReasoningEngine } from "./ReasoningEngine";

describe("ReasoningEngine canonical provider", () => {
  const originalPython = process.env.HOOSHYAR_PYTHON;

  afterEach(() => {
    if (originalPython === undefined) delete process.env.HOOSHYAR_PYTHON;
    else process.env.HOOSHYAR_PYTHON = originalPython;
  });

  test("reasons in-process with verified metrics and no external interpreter", () => {
    delete process.env.HOOSHYAR_PYTHON;

    const result = new ReasoningEngine().reason(
      "Revenue=2300 | Profit=1000 | ProfitMargin=0.4348 | DebtRatio=0.4",
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe("reasoned");
    expect(result.answer).toContain("1000");
    expect(result.provenance?.transformationRef).toBe("node-evidence-reasoning");
  });

  test("explicit HOOSHYAR_PYTHON is authoritative and fails closed when unusable", () => {
    process.env.HOOSHYAR_PYTHON = "nonexistent-python-binary";

    const result = new ReasoningEngine().reason("Profit=1000");

    expect(result.success).toBe(false);
    expect(result.status).toBe("reasoning_failed");
    expect(result.provenance?.transformationRef).toBe("python-ai-runtime");
  });
});
