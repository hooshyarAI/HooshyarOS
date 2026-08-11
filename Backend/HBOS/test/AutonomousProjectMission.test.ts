import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("AutonomousProjectMission", () => {
    it("selects the first genuinely missing canonical platform capability", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-mission-"));
        try {
            const mission = new AutonomousProjectMission(root);
            const next = mission.nextPlatformMission();

            expect(next?.capabilityId).toBe("platform.user-management");
            expect(next?.targetEngine).toBe("User Management Engine");
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it("keeps the completion gate separate from real platform capabilities", () => {
        const mission = new AutonomousProjectMission(process.cwd());
        const next = mission.nextMission();

        expect(next.capabilityId).not.toBe("platform.continuation");
    });
});
