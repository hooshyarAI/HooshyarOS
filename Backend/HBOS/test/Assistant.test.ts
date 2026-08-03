import { AssistantEngine } from "../Core/AssistantEngine";
import { Project } from "../Core/Project";


test("AssistantEngine analyzes project", () => {

    const assistant = new AssistantEngine();


    const project = new Project(
        "HBOS Core"
    );


    const result =
        assistant.analyzeProject(project);


    expect(result)
        .toContain("HBOS Core");

});