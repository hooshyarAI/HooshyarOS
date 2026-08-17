export interface ActionInput { capability: string; priority: "P0"|"P1"|"P2"|"P3"; blockers: string[]; tests: string[]; }
export function buildActionPlan(input: ActionInput) { return { capability: input.capability, priority: input.priority, executable: input.blockers.length===0, blockers: input.blockers, requiredTests: input.tests }; }
