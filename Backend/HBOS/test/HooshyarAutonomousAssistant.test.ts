import { HooshyarAutonomousAssistant } from "../Assistant/Autonomous/HooshyarAutonomousAssistant";
import type { ImprovementInput } from "../Assistant/Autonomous/ContinuousImprovementEngine";

function daemon() {
    return {
        run: () => ({ status: "completed", cycles: 1, history: [] })
    };
}

const canonicalEvidence: ImprovementInput = {
    tenantId: "tenant:autonomous-assistant",
    domain: "operational",
    actualImpact: {
        timeSaved: 10,
        operatingCostReduced: 500,
        actualFinancialValue: 1000,
        actualROI: 0.5,
        sustainability: "SUSTAINABLE"
    },
    expectedImpact: {
        timeSaved: 8,
        costReduced: 400,
        financialValue: 800,
        roi: 0.4
    },
    currentState: {
        revenue: 5000,
        profit: 1000,
        riskScore: 0.2,
        decisionLatency: 3
    }
};

describe("HooshyarOS Autonomous Assistant", () => {
    test("end-to-end runtime preserves result shape and fails safe without impact evidence", async () => {
        const assistant = new HooshyarAutonomousAssistant(daemon());
        const result = await assistant.execute(
            "Complete HooshyarOS autonomous development"
        );

        expect(result.identity.active).toBe(true);
        expect(result.lifecycle.status).toBe("COMPLETED");
        expect(result.lifecycle.completed).toBe(true);
        expect(result.lifecycle.progress).toBe(100);
        expect(result.lifecycle.lifecycle).toEqual([
            "OBSERVE",
            "REASON",
            "DECIDE",
            "PLAN",
            "EXECUTE",
            "VERIFY",
            "LEARN"
        ]);

        expect(result.runtime.reasoning.provider).toBe("python");
        expect(result.runtime.reasoning.problem).toBe("Complete HooshyarOS autonomous development");
        expect(result.runtime.reasoning.status).toBe("reasoned");
        expect(result.runtime.reasoning.success).toBe(true);
        expect(result.runtime.mission.status).toBe("COMPLETED");

        expect(result.evaluation.healthy).toBe(true);
        expect(result.tool.executed).toBe(true);
        expect(result.construction.status).toBe("completed");

        // No canonical impact measurement was supplied: the engine must fail
        // safe with NEEDS_DATA and must not fabricate recommendations.
        expect(result.improvement.status).toBe("NEEDS_DATA");
        expect(result.improvement.tenantId).toBe("");
        expect(result.improvement.domain).toBe("unknown");
        expect(result.improvement.recommendations).toEqual([]);
        expect(result.improvement.provenance.verificationStatus).toBe("FAILED");
    });

    test("invokes continuous improvement with canonical evidence when supplied", async () => {
        const assistant = new HooshyarAutonomousAssistant(daemon());
        const result = await assistant.execute(
            "Complete HooshyarOS autonomous development",
            canonicalEvidence
        );

        expect(result.improvement.status).toBe("READY");
        expect(result.improvement.tenantId).toBe(canonicalEvidence.tenantId);
        expect(result.improvement.domain).toBe(canonicalEvidence.domain);
        expect(result.improvement.recommendations.length).toBeGreaterThan(0);
        expect(result.improvement.provenance.verificationStatus).toBe("VERIFIED");
        expect(result.improvement.provenance.sourceRef).toBe("ContinuousImprovementEngine");
        expect(result.construction.status).toBe("completed");
    });
});
