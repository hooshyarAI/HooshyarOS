export interface ExecutionAuthorizationInput { blockers: string[]; scopeDefined: boolean; rollbackDefined: boolean; testsDefined: boolean; }
export function authorizeExecution(input: ExecutionAuthorizationInput): boolean { return input.blockers.length === 0 && input.scopeDefined && input.rollbackDefined && input.testsDefined; }
