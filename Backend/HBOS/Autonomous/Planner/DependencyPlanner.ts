export interface CapabilityDependency { capability: string; dependencies: string[]; }
export function planDependencyOrder(items: CapabilityDependency[]): string[] {
  const deps = new Map(items.map(x => [x.capability, new Set(x.dependencies)]));
  const result: string[] = [];
  while (deps.size) {
    const ready = [...deps].filter(([, d]) => [...d].every(x => result.includes(x)));
    if (!ready.length) throw new Error("DEPENDENCY_CYCLE_OR_MISSING_CAPABILITY");
    for (const [name] of ready) { result.push(name); deps.delete(name); }
  }
  return result;
}
