export function evaluatePreconditions(preconditions: Record<string, boolean>): { ready: boolean; blockers: string[] } {
 const blockers = Object.entries(preconditions).filter(([,ok]) => !ok).map(([name]) => name);
 return { ready: blockers.length === 0, blockers };
}
