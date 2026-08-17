import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const script = "Backend/AI_Runtime/commercial_autorepair.py";

describe("Commercial auto-repair safety gate", () => {
  it("contains no autonomous git mutation path", () => {
    const source = readFileSync(script, "utf8");

    expect(source).not.toMatch(/git\s+commit/);
    expect(source).not.toMatch(/git\s+push/);
    expect(source).not.toMatch(/git\s+add/);
    expect(source).not.toMatch(/write_text\s*\(/);
    expect(source).toContain("DIAGNOSTIC_ONLY");
    expect(source).toContain("independent-repair-verification-required");
  });

  it("fails closed instead of claiming an automatic repair succeeded", () => {
    const result = spawnSync(process.platform === "win32" ? "python" : "python3", [script], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(2);
    expect(result.stdout).toContain('"status": "BLOCKED"');
    expect(result.stdout).toContain('"reason": "independent-repair-verification-required"');
  });
});
