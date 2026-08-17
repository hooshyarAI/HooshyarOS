import { createHash } from "node:crypto";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";

export interface FinancialSourceEvidence {
  readonly sourceName: string;
  readonly sourceType: "CSV";
  readonly sha256: string;
  readonly receivedAt: string;
}

export interface FinancialTransaction {
  readonly date: string;
  readonly account: string;
  readonly debit: number;
  readonly credit: number;
  readonly currency: string;
}

export interface FinancialCanonicalModel {
  readonly tenantId: string;
  readonly source: FinancialSourceEvidence;
  readonly transactions: readonly FinancialTransaction[];
  readonly totals: {
    readonly debit: number;
    readonly credit: number;
    readonly balance: number;
  };
}

export interface FinancialIngestionResult {
  readonly evidence: FinancialSourceEvidence;
  readonly model: FinancialCanonicalModel;
  readonly persisted: boolean;
}

/**
 * First real financial-data vertical slice.
 * Source evidence -> CSV ingestion -> validation -> canonical normalization
 * -> tenant-scoped persistence -> independently calculated financial summary.
 */
export class FinancialDataIngestionAdapter {
  constructor(private readonly persistence: SQLitePersistenceStore) {}

  async ingestCsv(
    tenantId: string,
    sourceName: string,
    csv: string,
  ): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (!csv.trim()) throw new Error("ingestion-source-empty");

    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "CSV",
      sha256: createHash("sha256").update(csv, "utf8").digest("hex"),
      receivedAt: new Date().toISOString(),
    };

    const transactions = this.parseAndValidate(csv);
    const debit = this.round(transactions.reduce((sum, row) => sum + row.debit, 0));
    const credit = this.round(transactions.reduce((sum, row) => sum + row.credit, 0));

    const model: FinancialCanonicalModel = {
      tenantId: normalizedTenant,
      source,
      transactions,
      totals: { debit, credit, balance: this.round(debit - credit) },
    };

    await this.persistence.write(
      { tenantId: normalizedTenant },
      `financial-ingestion:${source.sha256}`,
      model,
    );

    return { evidence: source, model, persisted: true };
  }

  private parseAndValidate(csv: string): FinancialTransaction[] {
    const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("ingestion-header-and-data-required");

    const header = this.parseLine(lines[0]).map((value) => value.toLowerCase());
    const expected = ["date", "account", "debit", "credit", "currency"];
    if (header.length !== expected.length || header.some((value, index) => value !== expected[index])) {
      throw new Error("ingestion-schema-invalid");
    }

    return lines.slice(1).map((line, index) => {
      const row = this.parseLine(line);
      if (row.length !== expected.length) throw new Error(`ingestion-row-invalid:${index + 2}`);
      const [date, account, debitText, creditText, currency] = row.map((value) => value.trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`ingestion-date-invalid:${index + 2}`);
      if (!account) throw new Error(`ingestion-account-invalid:${index + 2}`);
      if (!currency) throw new Error(`ingestion-currency-invalid:${index + 2}`);

      const debit = this.parseAmount(debitText, index + 2, "debit");
      const credit = this.parseAmount(creditText, index + 2, "credit");
      if (debit === 0 && credit === 0) throw new Error(`ingestion-zero-row:${index + 2}`);
      if (debit > 0 && credit > 0) throw new Error(`ingestion-double-sided-row:${index + 2}`);

      return { date, account, debit, credit, currency };
    });
  }

  private parseLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) {
        values.push(current); current = "";
      } else current += char;
    }
    if (quoted) throw new Error("ingestion-unterminated-quote");
    values.push(current);
    return values;
  }

  private parseAmount(value: string, row: number, field: string): number {
    if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error(`ingestion-amount-invalid:${field}:${row}`);
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`ingestion-amount-invalid:${field}:${row}`);
    return this.round(amount);
  }

  private round(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
}
