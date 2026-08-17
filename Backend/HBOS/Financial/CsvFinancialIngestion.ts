export interface CanonicalFinancialRecord {
    tenantId: string;
    sourceId: string;
    rowNumber: number;
    accountCode: string;
    accountName: string;
    transactionDate: string;
    debit: number;
    credit: number;
    description: string;
}

export class CsvFinancialIngestion {
    ingest(csv: string, tenantId: string, sourceId: string): CanonicalFinancialRecord[] {
        if (!tenantId || !sourceId) throw new Error("Tenant and source are required");
        const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) throw new Error("CSV must contain a header and at least one record");
        const header = this.parseLine(lines[0]);
        const required = ["accountCode", "accountName", "transactionDate", "debit", "credit", "description"];
        if (header.length !== required.length || required.some((name, index) => header[index] !== name)) {
            throw new Error("Invalid financial CSV header");
        }
        return lines.slice(1).map((line, index) => {
            const values = this.parseLine(line);
            if (values.length !== required.length) throw new Error(`Invalid CSV row ${index + 2}`);
            const [accountCode, accountName, transactionDate, debitText, creditText, description] = values;
            const debit = Number(debitText);
            const credit = Number(creditText);
            if (!accountCode || !accountName || !/^\d{4}-\d{2}-\d{2}$/.test(transactionDate) || !Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
                throw new Error(`Invalid financial record at row ${index + 2}`);
            }
            return { tenantId, sourceId, rowNumber: index + 2, accountCode, accountName, transactionDate, debit, credit, description };
        });
    }

    private parseLine(line: string): string[] {
        const values: string[] = [];
        let value = "";
        let quoted = false;
        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
                if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
                else quoted = !quoted;
            } else if (char === "," && !quoted) {
                values.push(value.trim()); value = "";
            } else value += char;
        }
        if (quoted) throw new Error("Unclosed CSV quote");
        values.push(value.trim());
        return values;
    }
}
