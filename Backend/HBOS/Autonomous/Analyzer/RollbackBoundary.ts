export interface RollbackInput { rollbackPlanDefined: boolean; restorePointDefined: boolean; abortCriteriaDefined: boolean; }
export function rollbackReady(input: RollbackInput): boolean { return input.rollbackPlanDefined && input.restorePointDefined && input.abortCriteriaDefined; }
