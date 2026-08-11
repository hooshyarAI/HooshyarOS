import { HooshyarAutonomousAssistant } from "../Assistant/Autonomous/HooshyarAutonomousAssistant";

test("Assistant hands platform construction to the governed daemon", () => {
    const calls: string[] = [];
    const assistant = new HooshyarAutonomousAssistant({
        run: () => {
            calls.push("run");
            return { status: "completed", cycles: 1, history: [] };
        }
    });

    expect(assistant.continuePlatformConstruction()).toEqual({
        status: "completed",
        cycles: 1,
        history: []
    });
    expect(calls).toEqual(["run"]);
});
