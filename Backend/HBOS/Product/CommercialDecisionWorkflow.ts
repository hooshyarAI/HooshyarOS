import { CommercialAuthorizationBoundary } from "./CommercialAuthorizationBoundary";
import { CommercialPersistenceBoundary, PersistenceRecord } from "./CommercialPersistenceBoundary";

export interface CommercialDecisionInput {
  readonly token: string;
  readonly organization: string;
  readonly key: string;
  readonly decision: unknown;
}

export class CommercialDecisionWorkflow {
  constructor(
    private readonly authorization: CommercialAuthorizationBoundary,
    private readonly persistence: CommercialPersistenceBoundary,
  ) {}

  async execute(input: CommercialDecisionInput): Promise<PersistenceRecord> {
    const authorization = this.authorization.authorize({
      token: input.token,
      organization: input.organization,
      permission: "CREATE_DECISION",
    });

    if (!authorization.allowed || !authorization.session) {
      throw new Error(authorization.reason ?? "AUTHORIZATION_DENIED");
    }

    return this.persistence.write(
      { tenantId: authorization.session.tenantId },
      input.key,
      input.decision,
    );
  }
}
