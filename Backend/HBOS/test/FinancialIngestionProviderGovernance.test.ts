/**
 * Capability Provider Leverage — live enforcement at the ingestion boundary.
 *
 * Proves the registry is not display-only: a format backed by an external
 * provider is refused fail-closed when that provider is not admitted, while an
 * admitted provider leaves behaviour unchanged and internal-only formats are
 * never gated by an external provider.
 */
import { SQLitePersistenceStore } from "../Product/SQLitePersistenceStore";
import { FinancialIngestionService } from "../Product/FinancialIngestionService";
import { CapabilityProviderRegistry } from "../Product/CapabilityProviderRegistry";

describe("FinancialIngestionService — capability provider governance", () => {
  test("refuses an external-provider format when no provider is admitted", async () => {
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const service = new FinancialIngestionService(
      persistence,
      undefined,
      new CapabilityProviderRegistry([]),
    );

    await expect(
      service.ingest("tenant-a", {
        sourceName: "ledger.pdf",
        format: "PDF",
        contentBase64: Buffer.from("not a pdf").toString("base64"),
      }),
    ).rejects.toThrow(/ingestion-provider-not-admitted/);
  });

  test("admitted providers leave existing fail-closed behaviour unchanged", async () => {
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const service = new FinancialIngestionService(persistence);

    await expect(
      service.ingest("tenant-a", {
        sourceName: "ledger.pdf",
        format: "PDF",
        contentBase64: Buffer.from("not a pdf").toString("base64"),
      }),
    ).rejects.toThrow("ingestion-pdf-unsupported");
  });

  test("internal-only formats are not gated by an external provider", async () => {
    const persistence = new SQLitePersistenceStore({ databasePath: ":memory:" });
    const service = new FinancialIngestionService(
      persistence,
      undefined,
      new CapabilityProviderRegistry([]),
    );

    const outcome = await service.ingest("tenant-a", {
      sourceName: "ledger.csv",
      format: "CSV",
      content: "date,account,debit,credit,currency\n2026-08-01,Cash,100,0,IRR",
    });
    expect(outcome.result.model.transactions).toHaveLength(1);
  });
});
