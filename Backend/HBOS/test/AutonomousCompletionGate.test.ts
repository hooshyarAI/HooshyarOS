import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

function writeEvidence(root: string, relative: string, content = "evidence"): void {
    const path = join(root, relative);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content, "utf8");
}

function seedCanonicalAssistantEvidence(root: string): void {
    const files = [
        "Backend/HBOS/Assistant/Autonomous/AutonomousAssistantRuntime.ts",
        "Backend/HBOS/Assistant/Autonomous/AutonomousMissionController.ts",
        "Backend/HBOS/Assistant/Autonomous/HooshyarAutonomousAssistant.ts",
        "Backend/HBOS/Assistant/Autonomous/PythonReasoningAdapter.ts",
        "Backend/HBOS/Assistant/Autonomous/PersistentArchitectureMemory.ts",
        "Backend/HBOS/Assistant/Autonomous/DecisionKnowledgeStore.ts",
        "Backend/HBOS/Assistant/Autonomous/ContextRetrievalEngine.ts",
        "Backend/HBOS/Assistant/Autonomous/LearningFeedbackLoop.ts",
        "Backend/HBOS/Autonomous/AutonomousProjectConductor.ts",
        "Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts",
        "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts",
        "Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts",
        "Backend/HBOS/Builder/Autonomous/ArchitectureDrivenBuildController.ts",
        "Backend/HBOS/Builder/Autonomous/AutonomousConstructionEngine.ts",
        "Backend/HBOS/test/AutonomousMissionController.test.ts",
        "Backend/HBOS/test/AutonomousAssistantRuntime.test.ts",
        "Backend/HBOS/test/HooshyarAutonomousAssistant.test.ts",
        "Backend/HBOS/test/PythonReasoningAdapter.test.ts",
        "AGENTS.md"
    ];
    files.forEach(file => writeEvidence(root, file));

    writeEvidence(root, "Assistant/SYSTEM_PROMPT.md", "You are the autonomous construction intelligence of HooshyarOS. You are not a human executive's financial, managerial or commercial advisor.");
    writeEvidence(root, "Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts", 'ImplementationAgent = "python" GENERATE VERIFY REPAIR FINALIZE');
    writeEvidence(root, "Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts", "this.planner.plan(goal) controller.construct(plan.requirement)");
    writeEvidence(root, "Backend/HBOS/Builder/Autonomous/ArchitectureDrivenBuildController.ts", "ARCHITECTURE PLAN");
    writeEvidence(root, "Backend/HBOS/Autonomous/AutonomousProjectConductor.ts", "autonomous-self-healing");
    writeEvidence(root, "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts", "platform-continuation AUTONOMOUS_PLATFORM_COMPLETE");
    writeEvidence(root, "Backend/AI_Runtime/autonomous_builder.py", "argparse CAPABILITIES Capability ID: if not generated: platform.user-management platform.organization-model platform.security-layer");
    writeEvidence(root, "Backend/AI_Runtime/reasoning/reasoning_engine.py", 'class ReasoningEngine:\n    def reason(self): return {"status": "reasoned"}\n');
}

describe("Autonomous Assistant completion gate", () => {
    it("selects the completion gate only when all canonical Assistant evidence is present", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-autonomous-gate-"));
        try {
            seedCanonicalAssistantEvidence(root);
            const mission = new AutonomousProjectMission(root);
            const next = mission.nextMission();

            expect(next.capabilityId).toBe("assistant.completion.gate");
            expect(next.capability).toContain("completion gate");
            expect(next.evidence.clean).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
