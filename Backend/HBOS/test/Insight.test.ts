import { ProjectPilotEngine } from "../Engines/ProjectPilotEngine";
import { ProjectStatus } from "../Entities/ProjectStatus";

test("ProjectPilot can generate project insight", () => {
    const pilot = new ProjectPilotEngine();
    const project = pilot.createProject("HBOS Core");
    const insight = pilot.getProjectInsight(project);

    expect(insight.projectName).toBe("HBOS Core");
    expect(insight.status).toBe(ProjectStatus.Planning);
    expect(insight.message).toBe("Start project planning");
});
