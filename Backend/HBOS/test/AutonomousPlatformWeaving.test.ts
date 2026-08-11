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

    const complete = (root: string, paths: string[]) => paths.forEach(path => artifact(root, path));

    it("weaves the entire canonical backlog one knot at a time", () => {
        const root = createProject();
        const mission = new AutonomousProjectMission(root);

        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.user-management");

        complete(root, [
            "Backend/HBOS/Engines/UserManagementEngine.ts",
            "Backend/HBOS/test/UserManagementEngine.test.ts",
            "Docs/Engines/UserManagementEngine.md"
        ]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.organization-model");

        complete(root, [
            "Backend/HBOS/Engines/OrganizationModelEngine.ts",
            "Backend/HBOS/test/OrganizationModelEngine.test.ts",
            "Docs/Engines/OrganizationModelEngine.md"
        ]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.security-layer");

        complete(root, [
            "Backend/HBOS/Engines/SecurityLayerEngine.ts",
            "Backend/HBOS/test/SecurityLayerEngine.test.ts",
            "Docs/Engines/SecurityLayerEngine.md"
        ]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("engine.reasoning.canonical");

        complete(root, [
            "Backend/HBOS/Engines/ReasoningEngine.ts",
            "Backend/HBOS/test/ReasoningEngine.test.ts",
            "Backend/AI_Runtime/reasoning/reasoning_engine.py"
        ]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("engine.organizational.canonical");

        complete(root, [
            "Backend/HBOS/Engines/OrganizationalIntelligenceEngine.ts",
            "Backend/HBOS/test/OrganizationalIntelligenceEngine.test.ts"
        ]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("engine.autonomous-operations.canonical");

        complete(root, [
            "Backend/HBOS/Engines/AutonomousOperationsEngine.ts",
            "Backend/HBOS/test/AutonomousOperationsEngine.test.ts"
        ]);
        expect(mission.nextPlatformMission()?.capabilityId).toBe("runtime.reasoning.bridge");

        complete(root, [
            "Backend/HBOS/Engines/ReasoningEngine.ts",
            "Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts",
            "Backend/HBOS/test/PythonReasoningAdapter.test.ts",
            "Backend/AI_Runtime/reasoning/reasoning_engine.py"
        ]);
        expect(mission.nextPlatformMission()).toBeNull();
    });

    it("does not skip a later capability when an earlier capability is blocked", () => {
        const root = createProject();
        const mission = new AutonomousProjectMission(root);

        complete(root, [
            "Backend/HBOS/Engines/UserManagementEngine.ts",
            "Backend/HBOS/test/UserManagementEngine.test.ts",
            "Docs/Engines/UserManagementEngine.md",
            "Backend/HBOS/Engines/OrganizationModelEngine.ts",
            "Backend/HBOS/test/OrganizationModelEngine.test.ts",
            "Docs/Engines/OrganizationModelEngine.md",
            "Backend/HBOS/Engines/SecurityLayerEngine.ts",
            "Backend/HBOS/test/SecurityLayerEngine.test.ts",
            "Docs/Engines/SecurityLayerEngine.md"
        ]);

        expect(mission.nextPlatformMission()?.capabilityId).toBe("engine.reasoning.canonical");
    });
});
