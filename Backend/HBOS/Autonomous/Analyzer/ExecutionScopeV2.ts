export interface ExecutionScope { files: string[]; capabilities: string[]; maxChanges: number; }
export function isScopeBounded(scope: ExecutionScope): boolean { return scope.files.length > 0 && scope.capabilities.length > 0 && scope.maxChanges > 0; }
