import { ProjectPilotEngine } from "../Core/ProjectPilotEngine";
import { ProjectStatus } from "../Core/ProjectStatus";


test("ProjectPilot can generate project insight", () => {

    const pilot = new ProjectPilotEngine();

    pilot.createProject("HBOS Core");

    const project = pilot.getProjects()[0];

    const insight = pilot.getProjectInsight(project);

    expect(insight.projectName).toBe("HBOS Core");

    expect(insight.status).toBe(ProjectStatus.Planning);

    expect(insight.message).toBe("Start project planning");

});