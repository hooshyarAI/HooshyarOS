export function reevaluate(previous:string, current:string): {changed:boolean; state:string} { return {changed:previous!==current,state:current}; }
