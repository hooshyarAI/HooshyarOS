import { AutonomousBuildDaemon } from "./AutonomousBuildDaemon";
import { AutonomousDevelopmentLoop, AutonomousDevelopmentResult } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousProjectMission } from "./AutonomousProjectMission";
import { AutonomousPlatformContinuation } from "./AutonomousPlatformContinuation";

describe("AutonomousBuildDaemon", () => {
    it("executes the first real platform capability at the assistant completion handoff", () => {
        const developmentExecute = jest.fn((goal: any): AutonomousDevelopmentResult => ({
            status: "completed",
            goal,
            plan: { requirement: {} } as any,
            result: {
                ok: true,
                status: "BUILT",
                attempts: 0,
                selectedTool: "git",
                issues: [],
                trace: ["ARCHITECTURE", "PLAN", "GENERATE", "VERIFY", "FINALIZE"],
                details: "verified construction evidence",
                stage: "FINALIZE"
            }
        }));

        const mission = {
            snapshot: jest
                .fn()
                .mockReturnValueOnce({ commit: "before", clean: true })
                .mockReturnValue({ commit: "after", clean: true }),
            nextMission: jest.fn(() => ({
                capabilityId: "assistant.completion.gate",
                capability: "HooshyarOS Autonomous Assistant completion gate",
                targetEngine: "Autonomous Operations Engine",
                dependencies: [],
                evidence: {} as any,
                directives: [],
                architectureRules: []
            })),
            nextPlatformMission: jest.fn(() => ({
                capabilityId: "platform.user-management",
                capability: "implement the Phase 2 User Management capability",
                targetEngine: "User Management Engine",
                dependencies: ["HBOS Core", "Governance Engine"]
            }))
        } as unknown as AutonomousProjectMission;

        const platformMission = {
            capabilityId: "platform.user-management",
            capability: "implement the Phase 2 User Management capability",
            targetEngine: "User Management Engine",
            dependencies: ["HBOS Core", "Governance Engine"]
        };

        const continuation = {
            createMission: jest.fn(() => ({
                capabilityId: "platform.continuation" as const,
                capability: "continue autonomous construction of HooshyarOS platform capabilities",
                instruction: "AUDIT → SELECT NEXT GENUINELY MISSING CAPABILITY → IMPLEMENT → TEST → INTEGRATE → VERIFY → COMMIT → PUSH → AUDIT AGAIN",
                source: "assistant.completion.gate" as const
            })),
            selectNextCapability: jest.fn(() => platformMission)
        } as unknown as AutonomousPlatformContinuation;

        const development = { execute: developmentExecute } as unknown as AutonomousDevelopmentLoop;
        const daemon = new AutonomousBuildDaemon({ maxCycles: 1, mission, continuation, development });
        const result = daemon.run();

        expect(result.status).toBe("cycle_limit");
        expect(result.cycles).toBe(1);
        expect(result.history).toHaveLength(1);
        expect(result.history[0]).toEqual(expect.objectContaining({
            cycle: 1,
            mission: expect.stringContaining("User Management"),
            capabilityId: "platform.user-management",
            targetEngine: "User Management Engine",
            assistantGatePassed: true
        }));
        expect(continuation.createMission).toHaveBeenCalledTimes(1);
        expect(continuation.selectNextCapability).toHaveBeenCalledTimes(1);
        expect(developmentExecute).toHaveBeenCalledTimes(1);
        expect(developmentExecute.mock.calls[0]?.[0]).toEqual(expect.objectContaining(platformMission));
    });

    it("refuses platform completion when final evidence is incomplete", () => {
        const mission = {
            snapshot: jest.fn(() => ({ commit: "abc123", clean: true })),
            nextMission: jest.fn(() => ({
                capabilityId: "assistant.completion.gate",
                capability: "HooshyarOS Autonomous Assistant completion gate",
                targetEngine: "Autonomous Operations Engine",
                dependencies: [],
                evidence: {} as any,
                directives: [],
                architectureRules: []
            })),
        } as unknown as AutonomousProjectMission;

        const continuation = {
            createMission: jest.fn(() => ({
                capabilityId: "platform.continuation" as const,
                capability: "continue autonomous construction of HooshyarOS platform capabilities",
                instruction: "AUDIT → SELECT NEXT GENUINELY MISSING CAPABILITY → IMPLEMENT → TEST → INTEGRATE → VERIFY → COMMIT → PUSH → AUDIT AGAIN",
                source: "assistant.completion.gate" as const
            })),
            selectNextCapability: jest.fn(() => null)
        } as unknown as AutonomousPlatformContinuation;

        const execute = jest.fn((): never => { throw new Error("completion must not execute without evidence"); });
        const development = { execute } as unknown as AutonomousDevelopmentLoop;
        const daemon = new AutonomousBuildDaemon({ maxCycles: 1, mission, continuation, development });

        const result = daemon.run();

        expect(result.status).toBe("cycle_limit");
        expect(result.history).toHaveLength(1);
        expect(execute).toHaveBeenCalledTimes(1);
        expect((execute.mock.calls[0]?.[0] as any).capabilityId).toBe("assistant.completion.evidence");
        expect((execute.mock.calls[0]?.[0] as any).capability).toContain("documentation");
    });
});
