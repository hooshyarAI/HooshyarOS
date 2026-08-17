import { authorizeExecution } from "./ExecutionAuthorization";
describe("Execution authorization", () => { it("fails closed", () => { expect(authorizeExecution({ blockers: [], scopeDefined: true, rollbackDefined: true, testsDefined: true })).toBe(true); expect(authorizeExecution({ blockers: ["RISK"], scopeDefined: true, rollbackDefined: true, testsDefined: true })).toBe(false); }); });
