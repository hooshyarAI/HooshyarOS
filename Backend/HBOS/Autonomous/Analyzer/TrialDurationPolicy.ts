export function trialDurationAllowed(days: number, approvedExtension: boolean): boolean { return days === 30 || ((days === 60 || days === 90) && approvedExtension); }
