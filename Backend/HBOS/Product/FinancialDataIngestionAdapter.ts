import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { SQLitePersistenceStore } from "./SQLitePersistenceStore";

export interface FinancialSourceEvidence {
  readonly sourceName: string;
  readonly sourceType: "CSV" | "STRUCTURED";
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
 * Canonical financial-data vertical slice.
 * File source -> CSV ingestion -> validation -> canonical normalization
 * -> tenant-scoped persistence -> independently calculated financial summary.
 */
export class FinancialDataIngestionAdapter {
  constructor(private readonly persistence: SQLitePersistenceStore) {}

  async ingestFile(tenantId: string, sourcePath: string): Promise<FinancialIngestionResult> {
    const normalizedPath = sourcePath.trim();
    if (!normalizedPath) throw new Error("ingestion-source-path-required");
    const sourceName = basename(normalizedPath);
    const ext = sourceName.toLowerCase().split('.').pop();
    const content = await readFile(normalizedPath, "utf8");

    if (ext === 'json') {
      return this.ingestStructured(tenantId, sourceName, content);
    }
    return this.ingestCsv(tenantId, sourceName, content);
  }

  async ingestCsv(tenantId: string, sourceName: string, csv: string): Promise<FinancialIngestionResult> {
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

    await this.persistence.write({ tenantId: normalizedTenant }, `financial-ingestion:${source.sha256}`, model);
    return { evidence: source, model, persisted: true };
  }

  async ingestStructured(tenantId: string, sourceName: string, json: string): Promise<FinancialIngestionResult> {
    const normalizedTenant = tenantId.trim();
    const normalizedSource = sourceName.trim();
    if (!normalizedTenant) throw new Error("ingestion-tenant-required");
    if (!normalizedSource) throw new Error("ingestion-source-required");
    if (!json.trim()) throw new Error("ingestion-source-empty");

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error("ingestion-json-parse-error");
    }

    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Record<string, unknown>).transactions)) {
      throw new Error("ingestion-structured-schema-invalid");
    }

    const raw = parsed as {
      tenantId?: string;
      transactions: unknown[];
    };

    const sha256 = createHash("sha256").update(json, "utf8").digest("hex");
    const receivedAt = new Date().toISOString();

    const source: FinancialSourceEvidence = {
      sourceName: normalizedSource,
      sourceType: "STRUCTURED",
      sha256,
      receivedAt,
    };

    const transactions = this.validateStructuredTransactions(raw.transactions, json);
    const debit = this.round(transactions.reduce((sum, row) => sum + row.debit, 0));
    const credit = this.round(transactions.reduce((sum, row) => sum + row.credit, 0));

    const model: FinancialCanonicalModel = {
      tenantId: normalizedTenant,
      source,
      transactions,
      totals: { debit, credit, balance: this.round(debit - credit) },
    };

    await this.persistence.write({ tenantId: normalizedTenant }, `financial-ingestion:${source.sha256}`, model);
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

  private validateStructuredTransactions(txns: unknown[], rawJson: string): FinancialTransaction[] {
    if (!Array.isArray(txns)) throw new Error("ingestion-structured-schema-invalid");

    return txns.map((txn, index) => {
      if (typeof txn !== "object" || txn === null) {
        throw new Error(`ingestion-structured-txn-invalid:${index}`);
      }
      const row = txn as Record<string, unknown>;
      const date = String(row.date ?? "");
      const account = String(row.account ?? "");
      const debit = typeof row.debit === "number" ? row.debit : 0;
      const credit = typeof row.credit === "number" ? row.credit : 0;
      const currency = String(row.currency ?? "");

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`ingestion-date-invalid:${index}`);
      if (!account) throw new Error(`ingestion-account-invalid:${index}`);
      if (!currency) throw new Error(`ingestion-currency-invalid:${index}`);
      if (debit === 0 && credit === 0) throw new Error(`ingestion-zero-row:${index}`);
      if (debit > 0 && credit > 0) throw new Error(`ingestion-double-sided-row:${index}`);
      if (!Number.isFinite(debit) || debit < 0) throw new Error(`ingestion-amount-invalid:debit:${index}`);
      if (!Number.isFinite(credit) || credit < 0) throw new Error(`ingestion-amount-invalid:credit:${index}`);

      return { date, account, debit: this.round(debit), credit: this.round(credit), currency };
    });
  }
}
