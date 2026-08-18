export interface CustomerAccessInput { authorized: boolean; tenantMatches: boolean; encrypted: boolean; }
export function customerAccessAllowed(input: CustomerAccessInput): boolean {
    return input.authorized && input.tenantMatches && input.encrypted;
}
