import { defineExecutionScope } from "./ExecutionScope";
describe("Execution scope", () => { it("bounds changed artifacts", () => { expect(defineExecutionScope(["a.ts"], 3)).toBe(true); expect(defineExecutionScope(["a.ts","b.ts","c.ts","d.ts"], 3)).toBe(false); }); });
