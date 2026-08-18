export interface CustomerPrivacyBoundary { authorized: boolean; tenantMatch: boolean; encrypted: boolean; }
export function customerDataAccessible(b: CustomerPrivacyBoundary): boolean { return b.authorized && b.tenantMatch && b.encrypted; }
