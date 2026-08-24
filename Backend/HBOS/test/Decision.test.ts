import { DecisionEngine } from "../Engines/DecisionEngine";
import { Project } from "../Entities/Project";
import { ProjectStatus } from "../Entities/ProjectStatus";

test("DecisionEngine evaluates project status", () => {
    const engine = new DecisionEngine();
    const project = new Project("HBOS Core");

    const decision = engine.decide(project);

    expect(decision.status).toBe(ProjectStatus.Planning);
    expect(decision.message).toBe("Start project planning");
});
