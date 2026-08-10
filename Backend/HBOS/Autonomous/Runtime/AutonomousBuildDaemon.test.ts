jest.mock("../../Architecture/Autonomous/AutonomousDevelopmentLoop", () => ({
    AutonomousDevelopmentLoop: jest.fn().mockImplementation(() => ({
        execute: jest.fn(() => ({
            status: "completed",
            plan: { requirement: {} },
            result: { ok: true }
        }))
    }))
}));

jest.mock("./AutonomousProjectMission", () => ({
    AutonomousProjectMission: jest.fn().mockImplementation(() => ({
        snapshot: jest.fn()
            .mockReturnValueOnce({ commit: "before", clean: true })
            .mockReturnValue({ commit: "after", clean: true }),
        nextMission: jest.fn(() => ({
            capabilityId: "assistant.completion.gate",
            capability: "HooshyarOS Autonomous Assistant completion gate",
            targetEngine: "Autonomous Operations Engine",
            dependencies: []
        }))
    }))
}));

jest.mock("./LocalConstructionToolset", () => ({
    createLocalConstructionTools: jest.fn(() => [])
}));

describe("AutonomousBuildDaemon", () => {
    it("executes platform continuation instead of terminating at the assistant completion gate", () => {
        const { AutonomousBuildDaemon } = require("./AutonomousBuildDaemon");
        const { AutonomousDevelopmentLoop } = require("../../Architecture/Autonomous/AutonomousDevelopmentLoop");

        const daemon = new AutonomousBuildDaemon({ maxCycles: 1 });
        const result = daemon.run();

        expect(result.status).toBe("completed");
        expect(AutonomousDevelopmentLoop).toHaveBeenCalledTimes(1);
        expect(AutonomousDevelopmentLoop.mock.results[0].value.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                capabilityId: "platform.continuation",
                capability: expect.stringContaining("continue autonomous construction")
            })
        );
    });
});
