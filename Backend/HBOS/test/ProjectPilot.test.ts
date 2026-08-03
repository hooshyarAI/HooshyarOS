import { ProjectPilotEngine } from "../Core/ProjectPilotEngine";


test("ProjectPilot can create project", () => {

    const pilot = new ProjectPilotEngine();

    pilot.createProject("HBOS Core");

    const projects = pilot.getProjects();

    expect(projects).toContain("HBOS Core");

});