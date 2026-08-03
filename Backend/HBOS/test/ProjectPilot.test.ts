import { ProjectPilotEngine } from "../Core/ProjectPilotEngine";
import { ProjectStatus } from "../Core/ProjectStatus";


test("ProjectPilot can create project", () => {

    const pilot = new ProjectPilotEngine();

    pilot.createProject("HBOS Core");

    const projects = pilot.getProjects();

    expect(projects[0].name).toBe("HBOS Core");

    expect(projects[0].status).toBe(ProjectStatus.Planning);

});


test("ProjectPilot can generate project decision", () => {

    const pilot = new ProjectPilotEngine();

    pilot.createProject("HBOS Core");

    const project = pilot.getProjects()[0];

    const decision = pilot.getProjectDecision(project);

    expect(decision.status).toBe(ProjectStatus.Planning);

    expect(decision.message).toBe("Start project planning");

});
test("ProjectPilot stores project creation in memory", () => {

    const pilot = new ProjectPilotEngine();

    pilot.createProject("HBOS Core");

    const memories = pilot.getMemory();

  expect(memories[0].type).toBe("PROJECT_CREATED");

expect(memories[0].data).toBe("HBOS Core");

expect(memories[0].source).toBe("ProjectPilotEngine");

});