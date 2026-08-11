import { HooshyarAutonomousAssistant } from "../Assistant/Autonomous/HooshyarAutonomousAssistant";

describe("Autonomous Assistant construction handoff", () => {
    it("automatically starts governed platform construction after Assistant lifecycle completion", async () => {
        let calls = 0;
        const daemon = {
            run: () => {
                calls += 1;
                return { status: "completed", cycles: 1, history: [] };
            }
        };

        const assistant = new HooshyarAutonomousAssistant(daemon);
        assistant.missionController = {
            executeMission: () => ({
                goal: "build HooshyarOS",
                status: "COMPLETED",
                stage: "LEARN",
                completed: true,
                progress: 100,
                tasks: [],
                execution: [],
                lifecycle: ["OBSERVE", "REASON", "DECIDE", "PLAN", "EXECUTE", "VERIFY", "LEARN"]
            })
        } as any;
        assistant.runtime = { execute: async () => ({ goal: "build HooshyarOS" }) } as any;
        assistant.evaluation = { evaluate: () => ({ healthy: true }) } as any;
        assistant.improvement = { improve: () => ({ improved: false }) } as any;
        assistant.tools = { execute: () => ({ executed: true }) } as any;
        assistant.memory = { record: () => undefined } as any;

        const result = await assistant.execute("build HooshyarOS");
        const construction = result.construction;

        expect(calls).toBe(1);
        expect(construction).not.toBeNull();
        expect(construction!.status).toBe("completed");
    });
});