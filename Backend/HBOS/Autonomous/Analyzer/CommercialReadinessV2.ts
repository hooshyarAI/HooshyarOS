export interface CommercialReadiness { security: boolean; persistence: boolean; ingestion: boolean; tenantIsolation: boolean; verification: boolean; recovery: boolean; }
export function commerciallyReady(r: CommercialReadiness): boolean { return r.security && r.persistence && r.ingestion && r.tenantIsolation && r.verification && r.recovery; }
