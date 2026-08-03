import { DecisionEngine } from "../Core/DecisionEngine";
import { ProjectStatus } from "../Core/ProjectStatus";


test("DecisionEngine evaluates project status", () => {

    const engine = new DecisionEngine();

    const decision = engine.evaluateProject(ProjectStatus.Planning);

    expect(decision.status).toBe(ProjectStatus.Planning);

    expect(decision.message).toBe("Start project planning");

});