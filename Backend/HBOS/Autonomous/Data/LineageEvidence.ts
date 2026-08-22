export interface LineageEvidence { sourceId:string; transformationIds:string[]; actor:string; timestamp:string; }
export function isLineageComplete(x:LineageEvidence):boolean { return Boolean(x.sourceId && x.actor && x.timestamp && x.transformationIds.length); }
