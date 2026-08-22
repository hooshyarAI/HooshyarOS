import { CsvFinancialIngestion } from "./CsvFinancialIngestion";

describe("CsvFinancialIngestion", () => {
    const ingestion = new CsvFinancialIngestion();

    it("normalizes real CSV rows into tenant-scoped canonical financial records", () => {
        const csv = [
            "accountCode,accountName,transactionDate,debit,credit,description",
            "1010,Cash,2026-08-17,1500000,0,Customer payment",
            "4010,Sales,2026-08-17,0,1500000,Customer payment"
        ].join("\n");
        expect(ingestion.ingest(csv, "tenant-a", "bank-csv-001")).toEqual([
            { tenantId: "tenant-a", sourceId: "bank-csv-001", rowNumber: 2, accountCode: "1010", accountName: "Cash", transactionDate: "2026-08-17", debit: 1500000, credit: 0, description: "Customer payment" },
            { tenantId: "tenant-a", sourceId: "bank-csv-001", rowNumber: 3, accountCode: "4010", accountName: "Sales", transactionDate: "2026-08-17", debit: 0, credit: 1500000, description: "Customer payment" }
        ]);
    });

    it("rejects malformed or unscoped financial input", () => {
        expect(() => ingestion.ingest("accountCode,accountName", "tenant-a", "source-1")).toThrow();
        expect(() => ingestion.ingest("accountCode,accountName,transactionDate,debit,credit,description\n1010,Cash,2026-08-17,-1,0,Bad", "tenant-a", "source-1")).toThrow();
        expect(() => ingestion.ingest("accountCode,accountName,transactionDate,debit,credit,description\n1010,Cash,2026-08-17,1,0,Ok", "", "source-1")).toThrow("Tenant and source are required");
    });
});
