import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface DecisionExecutionReceipt {
  readonly tenantId: string;
  readonly decisionId: string;
  readonly assignee: string;
  readonly approvedBy: string;
  readonly executedAt: string;
  readonly action: unknown;
}

export interface DecisionExecutionResult {
  readonly executed: true;
  readonly receiptPath: string;
  readonly receiptBytes: Uint8Array;
}

/**
 * Observable operational execution boundary for the commercial vertical slice.
 * The side effect is deliberately filesystem-backed so the execution result can
 * be independently observed and hashed before the durable evidence record is written.
 */
export class FilesystemDecisionExecutor {
  constructor(private readonly rootDirectory: string) {}

  async execute(input: Omit<DecisionExecutionReceipt, "executedAt">): Promise<DecisionExecutionResult> {
    const receipt: DecisionExecutionReceipt = {
      ...input,
      executedAt: new Date().toISOString(),
    };
    const receiptPath = join(
      this.rootDirectory,
      "tenants",
      input.tenantId,
      "executions",
      `${input.decisionId}.json`,
    );
    await mkdir(dirname(receiptPath), { recursive: true });
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2), "utf8");
    const receiptBytes = await readFile(receiptPath);
    return { executed: true, receiptPath, receiptBytes };
  }
}
