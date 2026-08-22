export function canAccessCustomerResource(requestTenant:string, resourceTenant:string, explicitAuthorization:boolean):boolean { return requestTenant===resourceTenant && explicitAuthorization; }
