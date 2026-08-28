import { ReasoningEngine } from "./ReasoningEngine";

describe("ReasoningEngine Windows UTF-8 bridge", () => {
  test("returns a successful response through the available Python runtime", () => {
    const previousPython = process.env.HOOSHYAR_PYTHON;
    if (!process.env.HOOSHYAR_PYTHON) delete process.env.HOOSHYAR_PYTHON;

    try {
      const result = new ReasoningEngine().reason(
        "Revenue=2300 | Profit=1000 | ProfitMargin=0.4348 | DebtRatio=0.4",
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe("reasoned");
      expect(result.answer).toContain("1000");
    } finally {
      if (previousPython === undefined) delete process.env.HOOSHYAR_PYTHON;
      else process.env.HOOSHYAR_PYTHON = previousPython;
    }
  });
});
