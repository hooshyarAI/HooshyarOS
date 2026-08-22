import { recommendRetentionAction } from "./CustomerRetentionRecommendation";

describe("Customer retention recommendation", () => {
    it("prioritizes integration repair when integration blocks value", () => {
        expect(recommendRetentionAction({
            health: "AT_RISK",
            lowUsage: true,
            missingCapability: true,
            integrationProblem: true,
            valueNotProven: true,
        })).toEqual({
            action: "FIX_INTEGRATION",
            reason: "INTEGRATION_BLOCKS_VALUE",
        });
    });

    it("recommends capability enablement when adoption is missing", () => {
        expect(recommendRetentionAction({
            health: "AT_RISK",
            lowUsage: false,
            missingCapability: true,
            integrationProblem: false,
            valueNotProven: false,
        })).toEqual({
            action: "ENABLE_CAPABILITY",
            reason: "CAPABILITY_ADOPTION_GAP",
        });
    });

    it("does not treat an unverified customer as healthy", () => {
        expect(recommendRetentionAction({
            health: "INSUFFICIENT_EVIDENCE",
            lowUsage: false,
            missingCapability: false,
            integrationProblem: false,
            valueNotProven: false,
        })).toEqual({
            action: "MONITOR",
            reason: "READINESS_OR_SUBSCRIPTION_EVIDENCE_INSUFFICIENT",
        });
    });
});
