/**
 * Stage 08-ENT.2 — Generic Database Acquisition Contract.
 *
 * Supporting service under the canonical FinancialDataIngestionAdapter.
 * Defines a read-only database connector that:
 *   - Connects via a caller-supplied `DbDriver` (no real DB driver bundled)
 *   - Rejects write attempts (INSERT/UPDATE/DELETE/DDL/transaction-control)
 *   - Validates queries before execution
 *   - Maps rows to canonical financial-transaction records
 *
 * This module is NOT a new Engine. No real DB driver is included; tests
 * inject a stub driver.
 */

export const DB_ERROR_CODES = {
  CONNECTION_REQUIRED: "ingestion-db-connection-required",
  QUERY_REQUIRED: "ingestion-db-query-required",
  WRITE_REJECTED: "ingestion-db-write-rejected",
  QUERY_INVALID: "ingestion-db-query-invalid",
  DRIVER_REQUIRED: "ingestion-db-driver-required",
  ROW_MAPPING_FAILED: "ingestion-db-row-mapping-failed",
} as const;

const FORBIDDEN_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "MERGE", "UPSERT", "REPLACE",
  "CREATE", "DROP", "ALTER", "TRUNCATE", "RENAME", "GRANT", "REVOKE",
  "BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT",
];

const FORBIDDEN_PATTERNS: RegExp[] = [
  /;.*\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|DROP|ALTER|TRUNCATE)\b/i,
];

export interface DbRow {
  readonly [column: string]: unknown;
}

export interface DbDriver {
  connect(connectionString: string): Promise<DbConnection>;
}

export interface DbConnection {
  query(sql: string, params?: ReadonlyArray<unknown>): Promise<ReadonlyArray<DbRow>>;
  close(): Promise<void>;
}

export interface GenericDbConnectorConfig {
  readonly connectionString: string;
  readonly driver: DbDriver;
  /** Optional mapper from DbRow to canonical tx record. */
  readonly mapRow: (row: DbRow) => Record<string, unknown> | null;
  /** Optional row cap for safety. Default 100000. */
  readonly maxRows?: number;
}

/**
 * Validate that the query is read-only. Returns null on success,
 * or the first FORBIDDEN keyword matched on failure.
 */
export function validateReadOnlyQuery(sql: string): string | null {
  if (typeof sql !== "string") return "query-not-a-string";
  const trimmed = sql.trim();
  if (!trimmed) return "query-empty";
  // Remove leading comments and string literals so that keywords inside
  // them do not trip the read-only filter. This is a defense-in-depth
  // filter, not a full SQL parser; the canonical driver is responsible
  // for the final authorization.
  const noComments = trimmed
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, '""')
    .trim();
  // Must start with SELECT or WITH (CTE)
  const first = noComments.split(/\s+/)[0]?.toUpperCase();
  const statements = noComments.split(";").map((s) => s.trim()).filter(Boolean);
  // If the first statement is a valid read but more statements follow,
  // surface multi-statement-not-allowed (cleaner signal for "; DROP").
  if (statements.length > 1) {
    const firstStmt = statements[0];
    const firstUpper = firstStmt.split(/\s+/)[0]?.toUpperCase() ?? "";
    if (firstUpper === "SELECT" || firstUpper === "WITH") {
      return "multi-statement-not-allowed";
    }
  }
  // Otherwise scan each statement for forbidden keywords.
  for (const stmt of statements) {
    for (const kw of FORBIDDEN_KEYWORDS) {
      const re = new RegExp(`\\b${kw}\\b`, "i");
      if (re.test(stmt)) return `forbidden-keyword:${kw}`;
    }
  }
  if (first !== "SELECT" && first !== "WITH") {
    return `query-must-start-with-select:${first ?? ""}`;
  }
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.test(noComments)) return "forbidden-pattern";
  }
  return null;
}

export interface DbFetchResult {
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly rejected: false;
}

export class GenericDbConnector {
  private readonly cfg: GenericDbConnectorConfig;
  private connection: DbConnection | null = null;
  constructor(cfg: GenericDbConnectorConfig) {
    if (!cfg?.connectionString?.trim()) throw new Error(DB_ERROR_CODES.CONNECTION_REQUIRED);
    if (!cfg?.driver) throw new Error(DB_ERROR_CODES.DRIVER_REQUIRED);
    if (typeof cfg.mapRow !== "function") throw new Error(DB_ERROR_CODES.ROW_MAPPING_FAILED);
    this.cfg = cfg;
  }

  async connect(): Promise<void> {
    if (this.connection) return;
    this.connection = await this.cfg.driver.connect(this.cfg.connectionString);
  }

  async close(): Promise<void> {
    if (!this.connection) return;
    await this.connection.close();
    this.connection = null;
  }

  async runQuery(sql: string, params?: ReadonlyArray<unknown>): Promise<DbFetchResult> {
    if (typeof sql !== "string" || !sql.trim()) {
      throw new Error(DB_ERROR_CODES.QUERY_REQUIRED);
    }
    const rejection = validateReadOnlyQuery(sql);
    if (rejection) {
      throw new Error(`${DB_ERROR_CODES.WRITE_REJECTED}:${rejection}`);
    }
    if (!this.connection) await this.connect();
    const max = this.cfg.maxRows ?? 100_000;
    const raw = await this.connection!.query(sql, params);
    if (raw.length > max) {
      throw new Error(`${DB_ERROR_CODES.QUERY_INVALID}:row-cap-exceeded:${raw.length}>${max}`);
    }
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < raw.length; i += 1) {
      const mapped = this.cfg.mapRow(raw[i]);
      if (mapped) rows.push(mapped);
    }
    return { rows, rejected: false };
  }
}