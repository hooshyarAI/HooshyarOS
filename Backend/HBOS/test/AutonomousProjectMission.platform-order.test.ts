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
        "Backend/HBOS/Builder/Autonomous/AutonomousProjectConductor.ts",
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

    const controller = join(root, "Backend/HBOS/Builder/Autonomous/ArchitectureDrivenBuildController.ts");
    mkdirSync(join(controller, ".."), { recursive: true });
    writeFileSync(controller, "ARCHITECTURE PLAN", "utf8");
    writeFileSync(join(root, "Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts"), 'type ImplementationAgent = "python"; Backend/AI_Runtime/autonomous_builder.py GENERATE VERIFY REPAIR FINALIZE', "utf8");
}

function completeCapability(root: string, engine: string, method: string): void {
    for (const [path, content] of [
        [`Backend/HBOS/Engines/${engine}.ts`, `${method}(value: string) { return value; }\n`],
        [`Backend/HBOS/test/${engine}.test.ts`, `test("behavior", () => { expect(new ${engine}().${method}("value")).toBe("value"); });\n`],
        [`Docs/Engines/${engine}.md`, `# ${engine}\n`]
    ] as const) {
        const target = join(root, path);
        mkdirSync(join(target, ".."), { recursive: true });
        writeFileSync(target, content, "utf8");
    }
}

describe("AutonomousProjectMission platform order", () => {
    let root: string;
    afterEach(() => root && rmSync(root, { recursive: true, force: true }));

    it("selects User Management first, then Organization, then Security", () => {
        root = mkdtempSync(join(tmpdir(), "hooshyar-mission-"));
        seedAssistantEvidence(root);
        const mission = new AutonomousProjectMission(root);

        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.user-management");
        completeCapability(root, "UserManagementEngine", "registerUser");
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.organization-model");
        completeCapability(root, "OrganizationModelEngine", "createOrganization");
        expect(mission.nextPlatformMission()?.capabilityId).toBe("platform.security-layer");
    });
});
