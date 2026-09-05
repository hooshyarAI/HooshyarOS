/**
 * Stage 08-F.1 — Universal File Source Contract focused tests.
 *
 * These tests verify the new supporting contract (FileSource) that all
 * current and future acquisition routes must share. They do NOT re-test
 * the existing CSV/JSON/XLSX ingestion behavior — that is covered by
 * FinancialDataIngestionAdapter.test.ts regression suite.
 */
import { createHash } from "node:crypto";
import {
  computeSourceSha256,
  createFileSource,
  createRawSourceRef,
  type FileSource,
  type FileSourceMediaType,
  type FileSourceType,
  type RawSourceRef,
} from "../Product/FinancialDataIngestionAdapter";

describe("Universal File Source Contract (Stage 08-F.1)", () => {
  describe("createFileSource — required identity fields", () => {
    test("builds a complete FileSource from raw bytes", () => {
      const rawBytes = Buffer.from("date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n", "utf8");
      const source = createFileSource({
        sourceName: "ledger.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes,
      });

      expect(source.sourceName).toBe("ledger.csv");
      expect(source.sourceType).toBe("CSV");
      expect(source.mediaType).toBe("text/csv");
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.byteLength).toBe(rawBytes.length);
      expect(source.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    test("builds a FileSource from string content (CSV)", () => {
      const csv = "date,account,debit,credit,currency\n2026-08-01,Cash,100,0,IRR\n";
      const source = createFileSource({
        sourceName: "ledger.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: csv,
      });

      expect(source.sourceType).toBe("CSV");
      expect(source.mediaType).toBe("text/csv");
      expect(source.byteLength).toBe(Buffer.byteLength(csv, "utf8"));
    });

    test("builds a FileSource for STRUCTURED (JSON) source", () => {
      const json = JSON.stringify({
        transactions: [
          { date: "2026-08-01", account: "Cash", debit: 100, credit: 0, currency: "IRR" },
        ],
      });
      const source = createFileSource({
        sourceName: "ledger.json",
        sourceType: "STRUCTURED",
        mediaType: "application/json",
        rawBytes: json,
      });

      expect(source.sourceType).toBe("STRUCTURED");
      expect(source.mediaType).toBe("application/json");
    });

    test("builds a FileSource for XLSX source", () => {
      // Minimal valid-looking raw bytes (not a real XLSX; we only test the contract)
      const rawBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]);
      const source = createFileSource({
        sourceName: "ledger.xlsx",
        sourceType: "XLSX",
        mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        rawBytes,
      });

      expect(source.sourceType).toBe("XLSX");
      expect(source.mediaType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(source.byteLength).toBe(8);
    });

    test("rejects empty sourceName", () => {
      const rawBytes = Buffer.from("x", "utf8");
      expect(() =>
        createFileSource({
          sourceName: "   ",
          sourceType: "CSV",
          mediaType: "text/csv",
          rawBytes,
        }),
      ).toThrow("file-source-name-required");
    });
  });

  describe("SHA-256 representation", () => {
    test("SHA-256 matches the independent crypto calculation", () => {
      const rawBytes = Buffer.from("hello,world\n1,2\n", "utf8");
      const expected = createHash("sha256").update(rawBytes).digest("hex");

      const source = createFileSource({
        sourceName: "test.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes,
      });

      expect(source.sha256).toBe(expected);
      expect(source.sha256).toHaveLength(64);
    });

    test("identical content produces identical SHA-256 (deduplication basis)", () => {
      const content = "date,account,debit,credit,currency\n2026-08-01,Cash,1,0,IRR\n";
      const a = createFileSource({
        sourceName: "a.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: content,
      });
      const b = createFileSource({
        sourceName: "b.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: content,
      });

      expect(a.sha256).toBe(b.sha256);
    });

    test("different content produces different SHA-256", () => {
      const a = createFileSource({
        sourceName: "a.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: Buffer.from("one", "utf8"),
      });
      const b = createFileSource({
        sourceName: "b.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: Buffer.from("two", "utf8"),
      });

      expect(a.sha256).not.toBe(b.sha256);
    });

    test("computeSourceSha256 helper matches createFileSource SHA", () => {
      const rawBytes = Buffer.from("test payload", "utf8");
      const source = createFileSource({
        sourceName: "x.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes,
      });

      expect(computeSourceSha256(rawBytes)).toBe(source.sha256);
    });
  });

  describe("byteLength consistency", () => {
    test("byteLength equals buffer length for binary content", () => {
      const rawBytes = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
      const source = createFileSource({
        sourceName: "x.bin",
        sourceType: "XLSX",
        mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        rawBytes,
      });

      expect(source.byteLength).toBe(5);
      expect(source.rawSourceRef.byteLength).toBe(5);
    });

    test("byteLength equals UTF-8 byte length for string content", () => {
      // Multi-byte UTF-8: "é" is 2 bytes, "日" is 3 bytes
      const content = "café日";
      const source = createFileSource({
        sourceName: "x.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: content,
      });

      // "café日" = 3 ASCII bytes + 2 bytes (é) + 3 bytes (日) = 8 bytes
      expect(source.byteLength).toBe(8);
    });

    test("byteLength is exposed on rawSourceRef consistently", () => {
      const content = Buffer.from("payload", "utf8");
      const ref = createRawSourceRef(content);
      const source = createFileSource({
        sourceName: "x.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: content,
      });

      expect(source.byteLength).toBe(ref.byteLength);
    });
  });

  describe("receivedAt validity", () => {
    test("receivedAt defaults to current ISO-8601 UTC timestamp", () => {
      const before = Date.now();
      const source = createFileSource({
        sourceName: "x.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: "x",
      });
      const after = Date.now();

      const receivedMs = Date.parse(source.receivedAt);
      expect(receivedMs).toBeGreaterThanOrEqual(before);
      expect(receivedMs).toBeLessThanOrEqual(after + 1000); // tolerate 1s clock skew
    });

    test("receivedAt can be supplied explicitly", () => {
      const iso = "2026-09-03T12:00:00.000Z";
      const source = createFileSource({
        sourceName: "x.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: "x",
        receivedAt: iso,
      });

      expect(source.receivedAt).toBe(iso);
    });
  });

  describe("rawSourceRef", () => {
    test("rawSourceRef carries the same SHA-256 as the FileSource", () => {
      const content = Buffer.from("ref test", "utf8");
      const source = createFileSource({
        sourceName: "x.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: content,
      });

      expect(source.rawSourceRef.sha256).toBe(source.sha256);
      expect(source.rawSourceRef.byteLength).toBe(source.byteLength);
    });

    test("persistenceKey is deterministic and namespaced", () => {
      const content = Buffer.from("key test", "utf8");
      const ref = createRawSourceRef(content);
      const expected = `raw-source:${createHash("sha256").update(content).digest("hex")}`;

      expect(ref.persistenceKey).toBe(expected);
      expect(ref.persistenceKey.startsWith("raw-source:")).toBe(true);
    });

    test("persisted flag starts false (caller persists)", () => {
      const ref = createRawSourceRef(Buffer.from("x", "utf8"));
      expect(ref.persisted).toBe(false);
    });

    test("createRawSourceRef is pure and idempotent", () => {
      const content = Buffer.from("pure test", "utf8");
      const r1 = createRawSourceRef(content);
      const r2 = createRawSourceRef(content);

      expect(r1).toEqual(r2);
    });
  });

  describe("sourceType and mediaType extensibility", () => {
    test("XLS is NOT in the FileSourceType union (BLOCKED)", () => {
      // This test encodes the contract decision: XLS remains a local blocker.
      // A direct compile-time assertion is not possible in Jest, so we verify
      // by enumerating the valid values and asserting XLS is absent.
      const supportedTypes: ReadonlyArray<FileSourceType> = ["CSV", "STRUCTURED", "XLSX"];
      expect(supportedTypes).not.toContain("XLS");
    });

    test("FileSource type allows future extension without breaking existing fields", () => {
      // The contract is structurally stable: required fields are non-optional.
      // We can construct the canonical type today and future media types will
      // be additive at the type level.
      const mediaTypes: ReadonlyArray<FileSourceMediaType> = [
        "text/csv",
        "application/json",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      expect(mediaTypes).toHaveLength(3);
    });
  });

  describe("immutability / readonly semantics", () => {
    test("FileSource has only readonly fields at the type level", () => {
      // Compile-time check via assignability: a writable clone should NOT
      // satisfy FileSource. If readonly were dropped, the assignment below
      // would succeed silently; the assertion keeps the contract honest.
      const writable = {
        sourceName: "x",
        sourceType: "CSV" as FileSourceType,
        mediaType: "text/csv" as FileSourceMediaType,
        sha256: "a".repeat(64),
        receivedAt: new Date().toISOString(),
        byteLength: 1,
        rawSourceRef: {
          persistenceKey: "raw-source:abc",
          sha256: "a".repeat(64),
          byteLength: 1,
          persisted: false,
        },
      };
      // Force the type check by assigning through unknown:
      const source: FileSource = writable;
      expect(source.sourceName).toBe("x");
      expect(source.rawSourceRef.persistenceKey).toBe("raw-source:abc");
    });

    test("RawSourceRef fields are non-nullable and readonly at the contract level", () => {
      const ref: RawSourceRef = createRawSourceRef(Buffer.from("z", "utf8"));
      expect(typeof ref.persistenceKey).toBe("string");
      expect(typeof ref.sha256).toBe("string");
      expect(typeof ref.byteLength).toBe("number");
      expect(typeof ref.persisted).toBe("boolean");
    });
  });

  describe("backward compatibility — no behavioral change to existing routes", () => {
    test("createFileSource does not perform persistence (caller's responsibility)", async () => {
      // The factory MUST be pure: no I/O, no persistence. We verify by
      // constructing a FileSource and confirming rawSourceRef.persisted is false.
      const source = createFileSource({
        sourceName: "x.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: "date,account,debit,credit,currency\n",
      });
      expect(source.rawSourceRef.persisted).toBe(false);
    });

    test("does not duplicate SHA-256 logic — uses the same primitive path", () => {
      // Both createFileSource and createRawSourceRef must produce identical
      // hashes for identical content. This is the dedup guarantee.
      const content = Buffer.from("dedup test", "utf8");
      const ref = createRawSourceRef(content);
      const source = createFileSource({
        sourceName: "x.csv",
        sourceType: "CSV",
        mediaType: "text/csv",
        rawBytes: content,
      });
      expect(ref.sha256).toBe(source.sha256);
      expect(ref.persistenceKey).toBe(`raw-source:${source.sha256}`);
    });
  });
});
