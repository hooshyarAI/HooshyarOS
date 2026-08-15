export interface APRVLRepairRequest {
  readonly issueType: string;
  readonly failureOutput: string;
}

export interface APRVLRepairEvidence {
  readonly authorized: boolean;
  readonly verified: boolean;
  readonly summary: string;
}

/**
 * Boundary contract for APRVL. Governance owns authorization; this adapter
 * only transports an already-authorized repair request and its evidence.
 */
export interface APRVLRepairAdapter {
  execute(request: APRVLRepairRequest): Promise<APRVLRepairEvidence>;
}
