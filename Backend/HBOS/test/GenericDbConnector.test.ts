/**
 * Stage 08-ENT.2 — Generic DB Connector tests.
 */
import {
  DB_ERROR_CODES,
  GenericDbConnector,
  validateReadOnlyQuery,
  type DbConnection,
  type DbDriver,
  type DbRow,
} from "../Product/GenericDbConnector";

function makeDriver(rows: DbRow[]): DbDriver & { queried: string[]; closed: boolean } {
  const driver = {
    queried: [] as string[],
    closed: false,
    async connect(_cs: string): Promise<DbConnection> {
      return {
        async query(sql: string): Promise<ReadonlyArray<DbRow>> {
          driver.queried.push(sql);
          return rows;
        },
        async close() { driver.closed = true; },
      };
    },
  };
  return driver;
}

describe("GenericDbConnector (Stage 08-ENT.2)", () => {
  test("rejects missing connectionString", () => {
    expect(() => new GenericDbConnector({
      connectionString: "", driver: makeDriver([]), mapRow: (r) => r,
    })).toThrow(DB_ERROR_CODES.CONNECTION_REQUIRED);
  });

  test("rejects missing driver", () => {
    expect(() => new GenericDbConnector({
      connectionString: "x", driver: undefined as unknown as DbDriver, mapRow: (r) => r,
    })).toThrow(DB_ERROR_CODES.DRIVER_REQUIRED);
  });

  test("validates SELECT/WITH queries", () => {
    expect(validateReadOnlyQuery("SELECT 1")).toBeNull();
    expect(validateReadOnlyQuery("WITH t AS (SELECT 1) SELECT * FROM t")).toBeNull();
  });

  test("rejects INSERT/UPDATE/DELETE/DDL/transaction", () => {
    expect(validateReadOnlyQuery("INSERT INTO x VALUES (1)")).toMatch(/forbidden-keyword:INSERT/);
    expect(validateReadOnlyQuery("UPDATE x SET a=1")).toMatch(/forbidden-keyword:UPDATE/);
    expect(validateReadOnlyQuery("DELETE FROM x")).toMatch(/forbidden-keyword:DELETE/);
    expect(validateReadOnlyQuery("DROP TABLE x")).toMatch(/forbidden-keyword:DROP/);
    expect(validateReadOnlyQuery("BEGIN; SELECT 1")).toMatch(/forbidden-keyword:BEGIN/);
    expect(validateReadOnlyQuery("SELECT 1; DROP TABLE x")).toMatch(/multi-statement-not-allowed/);
  });

  test("rejects queries that do not start with SELECT/WITH", () => {
    expect(validateReadOnlyQuery("EXPLAIN SELECT 1")).toMatch(/must-start-with-select/);
    expect(validateReadOnlyQuery("")).toMatch(/query-empty/);
  });

  test("ignores forbidden keywords inside comments and string literals", () => {
    expect(validateReadOnlyQuery("SELECT 1 -- INSERT INTO x")).toBeNull();
    expect(validateReadOnlyQuery("SELECT 'INSERT INTO x' as c")).toBeNull();
  });

  test("runQuery returns mapped rows and never executes write", async () => {
    const driver = makeDriver([{ date: "2026-08-01", account: "Cash", debit: 100, credit: 0, currency: "IRR" }]);
    const c = new GenericDbConnector({
      connectionString: "x", driver, mapRow: (r) => ({ ...r }),
    });
    const result = await c.runQuery("SELECT * FROM ledger");
    expect(result.rows).toHaveLength(1);
    expect(driver.queried).toEqual(["SELECT * FROM ledger"]);
  });

  test("runQuery rejects write attempts", async () => {
    const driver = makeDriver([]);
    const c = new GenericDbConnector({
      connectionString: "x", driver, mapRow: (r) => r,
    });
    await expect(c.runQuery("DELETE FROM ledger")).rejects.toThrow(DB_ERROR_CODES.WRITE_REJECTED);
    expect(driver.queried).toEqual([]); // never called
  });

  test("runQuery enforces row cap", async () => {
    const driver = makeDriver(Array.from({ length: 5 }, (_, i) => ({ id: i })));
    const c = new GenericDbConnector({
      connectionString: "x", driver, maxRows: 3, mapRow: (r) => r,
    });
    await expect(c.runQuery("SELECT * FROM t")).rejects.toThrow(/row-cap-exceeded/);
  });

  test("connect / close lifecycle", async () => {
    const driver = makeDriver([]);
    const c = new GenericDbConnector({
      connectionString: "x", driver, mapRow: (r) => r,
    });
    await c.connect();
    await c.close();
    expect(driver.closed).toBe(true);
  });

  test("null rows from mapRow are skipped", async () => {
    const driver = makeDriver([{ a: 1 }, { a: 2 }, { a: 3 }]);
    const c = new GenericDbConnector({
      connectionString: "x", driver,
      mapRow: (r) => (r.a === 2 ? null : r),
    });
    const result = await c.runQuery("SELECT a FROM t");
    expect(result.rows).toHaveLength(2);
  });
});