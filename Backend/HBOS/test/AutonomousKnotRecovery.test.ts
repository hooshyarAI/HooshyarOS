import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { AutonomousKnotRecovery } from "../Autonomous/Runtime/AutonomousKnotRecovery";

jest.mock("node:child_process", () => ({
    execFileSync: jest.fn()
}));

jest.mock("node:fs", () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    rmSync: jest.fn()
}));

describe("AutonomousKnotRecovery", () => {
    const execFileSyncMock = execFileSync as unknown as jest.Mock;
    const existsSyncMock = existsSync as jest.Mock;
    const readFileSyncMock = readFileSync as jest.Mock;
    const rmSyncMock = rmSync as jest.Mock;
    const checkpoint = { capabilityId: "platform.user-management", commit: "abc123" };
    const recovery = new AutonomousKnotRecovery();

    beforeEach(() => jest.clearAllMocks());

    it("advances only when execution, verification and repository evidence agree", () => {
        const decision = recovery.observe(checkpoint, {
            capabilityId: checkpoint.capabilityId,
            executionOk: true,
            verificationComplete: true,
            repositoryChanged: true
        });

        expect(decision).toEqual(expect.objectContaining({
            recover: false,
            action: "ADVANCE",
            checkpoint
        }));
    });

    it("re-winds the current knot when verification detects a wrong result", () => {
        const decision = recovery.observe(checkpoint, {
            capabilityId: checkpoint.capabilityId,
            executionOk: true,
            verificationComplete: false,
            repositoryChanged: true
        });

        expect(decision).toEqual(expect.objectContaining({
            recover: true,
            action: "REPAIR",
            repairCapabilityId: "repair-platform.user-management",
            checkpoint
        }));
        expect(decision.rationale).toContain("last verified checkpoint");
    });

    it("removes canonical untracked artifacts after rollback so repair can restart cleanly", () => {
        execFileSyncMock
            .mockReturnValueOnce("head-sha")
            .mockReturnValueOnce("")
            .mockReturnValueOnce("")
            .mockReturnValueOnce("?? Backend/HBOS/Product/ExecutiveIntelligenceWorkbench.ts")
            .mockReturnValueOnce("");

        existsSyncMock.mockReturnValue(true);
        readFileSyncMock.mockReturnValue(JSON.stringify({
            capabilities: [{
                implementationPath: "Backend/HBOS/Product/ExecutiveIntelligenceWorkbench.ts",
                testPath: "Backend/HBOS/test/ExecutiveIntelligenceWorkbench.test.ts",
                documentationPath: "Docs/Product/ExecutiveIntelligenceWorkbench.md"
            }]
        }));

        recovery.rollback("C:\\repo", {
            capabilityId: "product.executive-intelligence-workbench",
            commit: "head-sha"
        });

        expect(rmSyncMock).toHaveBeenCalledWith(
            "C:\\repo\\Backend/HBOS/Product/ExecutiveIntelligenceWorkbench.ts",
            { force: true }
        );
        expect(execFileSyncMock).toHaveBeenCalledWith(
            "git",
            ["reset", "--hard", "head-sha"],
            expect.objectContaining({ cwd: "C:\\repo" })
        );
    });
});
