import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

describe("AutonomousPlatformWeaving", () => {
    const createProject = () => {
        const root = join(tmpdir(), `hooshyar-weaving-${Date.now()}-${Math.random().toString(16).slice(2)}`);
        mkdirSync(root, { recursive: true });
        return root;
    };

    const artifact = (root: string, path: string) => {
        const target = join(root, path);
        mkdirSync(join(target, ".."), { recursive: true });
        writeFileSync(target, "verified", "utf8");
    };

    it("selects the next platform capability one knot at a time", () => {
        const root = createProject();
        const mission = new AutonomousProjectMission(root);

        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.user-management");

        artifact(root, "Backend/HBOS/Engines/UserManagementEngine.ts");
        artifact(root, "Backend/HBOS/test/UserManagementEngine.test.ts");
        artifact(root, "Docs/Engines/UserManagementEngine.md");
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.organization-model");

        artifact(root, "Backend/HBOS/Engines/OrganizationModelEngine.ts");
        artifact(root, "Backend/HBOS/test/OrganizationModelEngine.test.ts");
        artifact(root, "Docs/Engines/OrganizationModelEngine.md");
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.security-layer");

        artifact(root, "Backend/HBOS/Engines/SecurityLayerEngine.ts");
        artifact(root, "Backend/HBOS/test/SecurityLayerEngine.test.ts");
        artifact(root, "Docs/Engines/SecurityLayerEngine.md");
        expect(mission.nextPlatformMission()).toBeNull();
    });
});
