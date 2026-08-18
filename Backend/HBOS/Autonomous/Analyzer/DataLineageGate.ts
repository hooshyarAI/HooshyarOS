export interface DataLineageInput { source: string; transformations: string[]; destination: string; }
export function lineageComplete(input: DataLineageInput): boolean {
    return input.source.trim().length > 0 && input.transformations.length > 0 && input.destination.trim().length > 0;
}
