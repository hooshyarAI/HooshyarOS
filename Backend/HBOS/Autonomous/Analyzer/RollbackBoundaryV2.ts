export interface RollbackBoundary { checkpointId: string; reversible: boolean; }
export function rollbackReady(boundary: RollbackBoundary): boolean { return boundary.checkpointId.length > 0 && boundary.reversible; }
