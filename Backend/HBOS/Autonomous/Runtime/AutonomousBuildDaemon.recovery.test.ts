import { AutonomousBuildDaemon } from "./AutonomousBuildDaemon";
import { AutonomousDevelopmentLoop, AutonomousDevelopmentResult } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousProjectMission } from "./AutonomousProjectMission";
import { AutonomousKnotRecovery } from "./AutonomousKnotRecovery";

describe("AutonomousBuildDaemon knot recovery", () => {
    it("repairs a failed knot from its checkpoint before allowing the run to continue", () => {
        const execute = jest.fn()
            .mockImplementationOnce((_goal: any): AutonomousDevelopmentResult => ({
                status: "blocked",
                goal: _goal,
                plan: { requirement: {} } as any,
                result: {
                    ok: false,
                    status: "BLOCKED",
                    attempts: 0,
                    selectedTool: "generator",
                    issues: ["verification failure"],
                    trace: ["ARCHITECTURE", "PLAN", "GENERATE"],
                    details: "first knot was wrong",
                    stage: "GENERATE"
                }
            }))
            .mockImplementationOnce((goal: any): AutonomousDevelopmentResult => ({
                status: "completed",
                goal,
                plan: { requirement: {} } as any,
                result: {
                    ok: true,
                    status: "BUILT",
                    attempts: 1,
                    selectedTool: "python",
                    issues: [],
                    trace: ["ARCHITECTURE", "PLAN", "GENERATE", "VERIFY", "FINALIZE"],
                    details: "knot repaired and verified",
                    stage: "FINALIZE"
                }
            }));

        const mission = {
            snapshot: jest.fn()
                .mockReturnValueOnce({ root: process.cwd(), commit: "HEAD", clean: true })
                .mockReturnValue({ root: process.cwd(), commit: "repaired", clean: true }),
            nextMission: jest.fn(() => ({
                capabilityId: "platform.user-management",
                capability: "implement User Management",
                targetEngine: "User Management Engine",
                dependencies: [],
                evidence: { root: process.cwd(), commit: "HEAD", clean: true, architectureFiles: [], engineCount: 1, runtimeFileCount: 1, latestCommits: [] },
                directives: [],
                architectureRules: []
            }))
        } as unknown as AutonomousProjectMission;

        const development = { execute } as unknown as AutonomousDevelopmentLoop;

        const knotRecovery = {
            observe: jest.fn()
                .mockReturnValueOnce({
                    recover: true,
                    action: "REPAIR",
                    checkpoint: {
                        capabilityId: "platform.user-management",
                        commit: "HEAD"
                    },
                    rationale: "test recovery",
                    repairCapabilityId: "repair-platform.user-management",
                    stopConditions: []
                })
                .mockReturnValueOnce({
                    recover: false,
                    action: "ADVANCE",
                    checkpoint: {
                        capabilityId: "platform.user-management",
                        commit: "HEAD"
                    },
                    rationale: "test repaired",
                    stopConditions: []
                }),
            rollback: jest.fn()
        } as unknown as AutonomousKnotRecovery;

        const daemon = new AutonomousBuildDaemon({
            maxCycles: 1,
            mission,
            development,
            knotRecovery
        });

        const result = daemon.run();

        expect(result.status).toBe("cycle_limit");
        expect(execute).toHaveBeenCalledTimes(2);
        expect(execute.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
            capabilityId: "repair-platform.user-management"
        }));
    });
});
