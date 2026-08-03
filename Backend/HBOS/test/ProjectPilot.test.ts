import { ProjectPilotEngine } from "../Core/ProjectPilotEngine";


test("ProjectPilot can create project", () => {

    const pilot = new ProjectPilotEngine();

    pilot.createProject("HBOS Core");

    const projects = pilot.getProjects();

    expect(projects[0].name).toBe("HBOS Core");

    expect(projects[0].status).toBe("Active");

});