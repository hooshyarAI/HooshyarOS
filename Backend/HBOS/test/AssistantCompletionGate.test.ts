import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AutonomousProjectMission } from "../Autonomous/Runtime/AutonomousProjectMission";

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
        "Backend/HBOS/Builder/Autonomous/AutonomousProjectConductor.ts",
        "Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts",
        "Backend/HBOS/Autonomous/Runtime/AutonomousBuildDaemon.ts",
        "Backend/HBOS/test/AutonomousMissionController.test.ts",
        "Backend/HBOS/test/AutonomousAssistantRuntime.test.ts",
        "Backend/HBOS/test/HooshyarAutonomousAssistant.test.ts",
        "Backend/HBOS/test/PythonReasoningAdapter.test.ts"
    ];
    for (const file of files) {
        const path = join(root, file);
        mkdirSync(join(path, ".."), { recursive: true });
        writeFileSync(path, "evidence", "utf8");
    }
    const runtime = join(root, "Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts");
    writeFileSync(runtime, 'type ImplementationAgent = "python"; GENERATE VERIFY REPAIR FINALIZE', "utf8");
    const loop = join(root, "Backend/HBOS/Architecture/Autonomous/AutonomousDevelopmentLoop.ts");
    mkdirSync(join(loop, ".."), { recursive: true });
    writeFileSync(loop, "this.planner.plan(goal); controller.construct(plan.requirement)", "utf8");
    const controller = join(root, "Backend/HBOS/Builder/Autonomous/ArchitectureDrivenBuildController.ts");
    mkdirSync(join(controller, ".."), { recursive: true });
    writeFileSync(controller, "ARCHITECTURE PLAN", "utf8");
    const builder = join(root, "Backend/AI_Runtime/autonomous_builder.py");
    mkdirSync(join(builder, ".."), { recursive: true });
    writeFileSync(builder, "argparse CAPABILITIES Capability ID: if not generated: platform.user-management platform.organization-model platform.security-layer", "utf8");
    const reasoning = join(root, "Backend/AI_Runtime/reasoning/reasoning_engine.py");
    mkdirSync(join(reasoning, ".."), { recursive: true });
    writeFileSync(reasoning, 'class ReasoningEngine:\n    def reason(self): return {"status": "reasoned"}\n', "utf8");
}

describe("Assistant completion gate", () => {
    it("selects the completion gate only when the canonical Assistant evidence is complete", () => {
        const root = mkdtempSync(join(tmpdir(), "hooshyar-assistant-gate-"));
        try {
            seedCanonicalAssistantEvidence(root);
            const mission = new AutonomousProjectMission(root);
            const next = mission.nextMission();

            expect(next.capabilityId).toBe("assistant.completion.gate");
            expect(next.targetEngine).toBe("Autonomous Operations Engine");
            expect(next.evidence.clean).toBe(true);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
