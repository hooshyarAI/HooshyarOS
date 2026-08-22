export interface DataLineage { sourceId: string; transformations: string[]; destination: string; }
export function lineageComplete(l: DataLineage): boolean { return !!l.sourceId && l.transformations.length > 0 && !!l.destination; }
