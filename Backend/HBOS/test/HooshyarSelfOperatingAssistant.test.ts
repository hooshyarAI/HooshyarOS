import { HooshyarSelfOperatingAssistant } from "../Assistant/Autonomous/HooshyarSelfOperatingAssistant";

test("HooshyarOS self operating assistant completes mission without invoking live construction", async () => {
    const fakeAssistant = {
        execute: jest.fn().mockResolvedValue({
            construction: { status: "completed" }
        })
    };

    const assistant = new HooshyarSelfOperatingAssistant(fakeAssistant);
    const result = await assistant.runMission("Continue autonomous HooshyarOS development");

    expect(result.status).toBe("COMPLETED");
    expect(result.decision.confidence).toBe(100);
    expect(result.health.healthy).toBe(true);
    expect(fakeAssistant.execute).toHaveBeenCalledWith("Continue autonomous HooshyarOS development");
});
