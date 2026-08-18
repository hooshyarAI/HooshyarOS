export interface DependencyInput { capability: string; dependencies: string[]; verified: string[]; }
export function dependenciesSatisfied(input: DependencyInput): boolean {
    const verified = new Set(input.verified);
    return input.dependencies.every(d => verified.has(d));
}
