export function executionIsComplete(executed: boolean, verified: boolean, reevaluated: boolean): boolean { return executed && verified && reevaluated; }
