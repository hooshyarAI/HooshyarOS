import { HooshyarAutonomousAssistant } from "../Assistant/Autonomous/HooshyarAutonomousAssistant";

test(
    "HooshyarOS Autonomous Assistant end-to-end runtime",
    async () => {
        const assistant = new HooshyarAutonomousAssistant();
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
        expect(result.improvement.improved).toBe(true);
        expect(result.tool.executed).toBe(true);
        expect(result.construction.status).toBe("completed");
    }
);
