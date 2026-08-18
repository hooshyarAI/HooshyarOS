import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutonomousBuildDaemon } from "./AutonomousBuildDaemon";
import { AutonomousDevelopmentLoop, AutonomousDevelopmentResult } from "../../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { AutonomousProjectMission } from "./AutonomousProjectMission";

describe("AutonomousBuildDaemon knot recovery", () => {
    it("repairs a failed knot from its checkpoint before allowing the run to continue", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-autonomous-recovery-"));
        try {
            writeFileSync(join(root, "README.md"), "fixture\n", "utf8");
            execFileSync("git", ["init", "-q"], { cwd: root });
            execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
            execFileSync("git", ["config", "user.name", "Hooshyar Test"], { cwd: root });
            execFileSync("git", ["add", "README.md"], { cwd: root });
            execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });

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

            const checkpoint = execFileSync("git", ["rev-parse", "HEAD"], {
                cwd: root,
                encoding: "utf8"
            }).trim();

            const mission = {
                snapshot: jest.fn()
                    .mockReturnValueOnce({ root, commit: checkpoint, clean: true })
                    .mockReturnValue({ root, commit: "repaired", clean: true }),
                nextMission: jest.fn(() => ({
                    capabilityId: "platform.user-management",
                    capability: "implement User Management",
                    targetEngine: "User Management Engine",
                    dependencies: [],
                    evidence: { root, commit: checkpoint, clean: true, architectureFiles: [], engineCount: 1, runtimeFileCount: 1, latestCommits: [] },
                    directives: [],
                    architectureRules: []
                }))
            } as unknown as AutonomousProjectMission;

            const development = { execute } as unknown as AutonomousDevelopmentLoop;
            const daemon = new AutonomousBuildDaemon({ root, maxCycles: 1, mission, development });

            const result = daemon.run();

            expect(result.status).toBe("cycle_limit");
            expect(execute).toHaveBeenCalledTimes(2);
            expect(execute.mock.calls[1]?.[0]).toEqual(expect.objectContaining({
                capabilityId: "repair-platform.user-management"
            }));
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
