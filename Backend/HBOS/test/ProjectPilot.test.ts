import { ProjectPilotEngine } from "../Core/ProjectPilotEngine";
import { ProjectStatus } from "../Core/ProjectStatus";


test("ProjectPilot can create project", () => {

    const pilot = new ProjectPilotEngine();

    pilot.createProject("HBOS Core");

    const projects = pilot.getProjects();

    expect(projects[0].name).toBe("HBOS Core");

    expect(projects[0].status).toBe(ProjectStatus.Planning);

});


test("Project can change status", () => {

    const pilot = new ProjectPilotEngine();

    pilot.createProject("HBOS Core");

    const project = pilot.getProjects()[0];

    project.activate();

    expect(project.status).toBe(ProjectStatus.Active);

});