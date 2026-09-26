import { HBOS } from "../Core/HBOS";
import { EngineDependencyManager } from "../Core/Dependency/EngineDependencyManager";

describe("Final Architecture Qualification", () => {
  test("boots the canonical engine graph and reports every critical engine healthy", () => {
    const hbos = new HBOS();

    expect(hbos.boot()).toBe(true);

    const health = hbos.health();
    expect(health.map((entry) => entry.name)).toEqual([
      "MemoryEngine",
      "ReactionEngine",
      "DecisionEngine",
      "ProjectPilotEngine",
      "KnowledgeEngine",
      "AssistantEngine",
      "IntelligenceEngine",
      "ReasoningEngine",
      "GovernanceEngine",
      "ExecutiveIntelligenceEngine",
      "OrganizationalIntelligenceEngine",
      "AutonomousOperationsEngine",
    ]);
    expect(health.every((entry) => entry.healthy)).toBe(true);
  });

  test("fails closed when the Assistant Engine dependency boundary is incomplete", () => {
    const dependencies = new EngineDependencyManager();
    dependencies.registerDependency("Assistant Engine", [
      "Memory Engine",
      "Knowledge Engine",
    ]);

    expect(dependencies.validate("Assistant Engine", [
      "Memory Engine",
      "Reaction Engine",
      "Decision Engine",
      "Project Pilot Engine",
    ])).toBe(false);

    expect(dependencies.validate("Assistant Engine", [
      "Memory Engine",
      "Reaction Engine",
      "Decision Engine",
      "Project Pilot Engine",
      "Knowledge Engine",
      "Assistant Engine",
    ])).toBe(true);
  });
});
