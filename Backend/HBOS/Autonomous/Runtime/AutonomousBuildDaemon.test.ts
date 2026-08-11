jest.mock("../../Architecture/Autonomous/AutonomousDevelopmentLoop", () => ({
    AutonomousDevelopmentLoop: jest.fn().mockImplementation(() => ({
        execute: jest.fn(() => ({
            status: "completed",
            plan: { requirement: {} },
            result: {
                ok: true,
                trace: ["ARCHITECTURE", "PLAN", "GENERATE", "VERIFY", "FINALIZE"],
                details: "verified construction evidence",
                stage: "FINALIZE"
            }
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
        })),
        nextPlatformMission: jest.fn(() => ({
            capabilityId: "platform.user-management",
            capability: "implement the Phase 2 User Management capability",
            targetEngine: "User Management Engine",
            dependencies: ["HBOS Core", "Governance Engine"]
        }))
    }))
}));

jest.mock("./AutonomousPlatformContinuation", () => ({
    AutonomousPlatformContinuation: jest.fn().mockImplementation(() => ({
        createMission: jest.fn(() => ({
            capabilityId: "platform.continuation",
            capability: "continue autonomous construction of HooshyarOS platform capabilities",
            instruction: "AUDIT → SELECT NEXT GENUINELY MISSING CAPABILITY → IMPLEMENT → TEST → INTEGRATE → VERIFY → COMMIT → PUSH → AUDIT AGAIN",
            source: "assistant.completion.gate"
        })),
        selectNextCapability: jest.fn((projectMission: { nextPlatformMission: () => unknown }) => projectMission.nextPlatformMission())
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

        expect(result.status).toBe("cycle_limit");
        expect(AutonomousDevelopmentLoop).toHaveBeenCalledTimes(1);
        expect(AutonomousDevelopmentLoop.mock.results[0].value.execute).toHaveBeenCalledWith(
            expect.objectContaining({
                capabilityId: "platform.user-management",
                capability: expect.stringContaining("User Management")
            })
        );
    });
});
