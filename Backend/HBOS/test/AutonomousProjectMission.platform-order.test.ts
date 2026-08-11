import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

function seedAssistantEvidence(root: string): void {
    const files = [
        "Backend/HBOS/Assistant/Autonomous/AutonomousAssistantRuntime.ts",
        "Backend/HBOS/Assistant/Autonomous/AutonomousMissionController.ts",
        "Backend/HBOS/Assistant/Autonomous/HooshyarAutonomousAssistant.ts",
        "Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts",
        "Backend/HBOS/Assistant/Autonomous/PersistentArchitectureMemory.ts",
        "Backend/HBOS/Assistant/Autonomous/DecisionKnowledgeStore.ts",
        "Backend/HBOS/Assistant/Autonomous/ContextRetrievalEngine.ts",
        "Backend/HBOS/Assistant/Autonomous/LearningFeedbackLoop.ts",
        "Backend/Builder/Autonomous/AutonomousProjectConductor.ts",
        "Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts",
        "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts",
        "Backend/HBOS/test/AutonomousMissionController.test.ts",
        "Backend/HBOS/test/AutonomousAssistantRuntime.test.ts",
        "Backend/HBOS/test/HooshyarAutonomousAssistant.test.ts",
        "Backend/HBOS/test/PythonReasoningAdapter.test.ts",
        "Backend/AI_Runtime/autonomous_builder.py",
        "Backend/AI_Runtime/reasoning/reasoning_engine.py"
    ];
    for (const file of files) {
        const path = join(root, file);
        mkdirSync(join(path, ".."), { recursive: true });
        writeFileSync(path, file.endsWith(".py") ? "class ReasoningEngine:\n    def reason(self): return {\"status\": \"reasoned\"}\n" : "", "utf8");
    }
    const architectureLoop = join(root, "Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts");
    mkdirSync(join(architectureLoop, ".."), { recursive: true });
    writeFileSync(architectureLoop, "this.planner.plan(goal); controller.construct(plan.requirement)", "utf8");

    const controller = join(root, "Backend/Builder/Autonomous/ArchitectureDrivenBuildController.ts");
    mkdirSync(join(controller, ".."), { recursive: true });
    writeFileSync(controller, "ARCHITECTURE PLAN", "utf8");

    writeFileSync(join(root, "Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts"), 'type ImplementationAgent = "python"; Backend/AI_Runtime/autonomous_builder.py GENERATE VERIFY REPAIR FINALIZE', "utf8");
    writeFileSync(join(root, "Backend/AI_Runtime/autonomous_builder.py"), "CAPABILITIES\nCapability ID:\nplatform.user-management\nplatform.organization-model\nplatform.security-layer\nif not generated:", "utf8");
    writeFileSync(join(root, "Backend/AI_Runtime/reasoning/reasoning_engine.py"), 'class ReasoningEngine:\n    def reason(self): return {"status": "reasoned"}\n', "utf8");
}

describe("AutonomousProjectMission platform order", () => {
    let root: string;
    afterEach(() => root && rmSync(root, { recursive: true, force: true }));

    it("selects User Management first, then Organization, then Security", () => {
        root = mkdtempSync(join(tmpdir(), "hooshyar-mission-"));
        seedAssistantEvidence(root);
        const mission = new AutonomousProjectMission(root);

        expect(mission.nextMission().capabilityId).toBe("platform.user-management");

        for (const path of [
            "Backend/HBOS/Engines/UserManagementEngine.ts",
            "Backend/HBOS/test/UserManagementEngine.test.ts",
            "Docs/Engines/UserManagementEngine.md"
        ]) {
            const target = join(root, path);
            mkdirSync(join(target, ".."), { recursive: true });
            writeFileSync(target, "implemented", "utf8");
        }
        expect(mission.nextMission().capabilityId).toBe("platform.organization-model");

        for (const path of [
            "Backend/HBOS/Engines/OrganizationModelEngine.ts",
            "Backend/HBOS/test/OrganizationModelEngine.test.ts",
            "Docs/Engines/OrganizationModelEngine.md"
        ]) {
            const target = join(root, path);
            mkdirSync(join(target, ".."), { recursive: true });
            writeFileSync(target, "implemented", "utf8");
        }
        expect(mission.nextMission().capabilityId).toBe("platform.security-layer");
    });
});
