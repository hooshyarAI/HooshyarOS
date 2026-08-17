import { DurableFinancialEvidenceStore } from "./DurableFinancialEvidenceStore";

export interface FinancialInsight {
    tenantId: string;
    evidenceIds: string[];
    totalDebit: number;
    totalCredit: number;
    balance: number;
    balanced: boolean;
}

export class FinancialIntelligence {
    constructor(private readonly evidenceStore: DurableFinancialEvidenceStore) {}

    summarizeTenant(tenantId: string): FinancialInsight {
        const evidence = this.evidenceStore.listByTenant(tenantId);
        const totalDebit = evidence.reduce((sum, item) => sum + item.payload.debit, 0);
        const totalCredit = evidence.reduce((sum, item) => sum + item.payload.credit, 0);
        return {
            tenantId,
            evidenceIds: evidence.map((item) => item.id),
            totalDebit,
            totalCredit,
            balance: totalDebit - totalCredit,
            balanced: totalDebit === totalCredit,
        };
    }
}
