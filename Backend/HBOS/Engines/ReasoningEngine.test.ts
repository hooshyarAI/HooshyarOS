import { existsSync } from "node:fs";
import { join } from "node:path";
import { ReasoningEngine } from "./ReasoningEngine";

describe("ReasoningEngine Windows UTF-8 bridge", () => {
  test("returns a successful response through the real Python runtime", () => {
    const repoPython = join(process.cwd(), ".venv", "Scripts", "python.exe");

    if (process.platform === "win32" && !existsSync(repoPython)) {
      throw new Error(`Expected repository Python runtime was not found: ${repoPython}`);
    }

    const previousPython = process.env.HOOSHYAR_PYTHON;
    process.env.HOOSHYAR_PYTHON =
      process.platform === "win32"
        ? repoPython
        : process.env.HOOSHYAR_PYTHON || "python";

    try {
      const result = new ReasoningEngine().reason(
        "Revenue=2300 | Profit=1000 | ProfitMargin=0.4348 | DebtRatio=0.4",
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe("reasoned");
      expect(result.answer).toContain("1000");
    } finally {
      if (previousPython === undefined) {
        delete process.env.HOOSHYAR_PYTHON;
      } else {
        process.env.HOOSHYAR_PYTHON = previousPython;
      }
    }
  });
});
