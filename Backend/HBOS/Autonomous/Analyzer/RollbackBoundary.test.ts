import { rollbackReady } from "./RollbackBoundary";
describe("Rollback boundary", () => { it("requires a recoverable execution boundary", () => { expect(rollbackReady({ rollbackPlanDefined: true, restorePointDefined: true, abortCriteriaDefined: true })).toBe(true); expect(rollbackReady({ rollbackPlanDefined: true, restorePointDefined: false, abortCriteriaDefined: true })).toBe(false); }); });
