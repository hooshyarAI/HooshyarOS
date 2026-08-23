import { ProjectPilotEngine } from "../Engines/ProjectPilotEngine";


test("Project creation triggers autonomous memory flow", () => {

    const pilot = new ProjectPilotEngine();


    pilot.createProject("HBOS Core");


    const memories = pilot.getMemory();


    expect(memories[0].type)
        .toBe("PROJECT_CREATED");


    expect(memories[0].source)
        .toBe("ProjectPilotEngine");

});