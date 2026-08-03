import { AssistantEngine } from "../Core/AssistantEngine";
import { Project } from "../Core/Project";


test("AssistantEngine analyzes project context", () => {

    const assistant = new AssistantEngine();


    const project = new Project(
        "HBOS Core"
    );


    const context = assistant.createContext(
    project
);


    const result =
        assistant.analyzeProject(context);


    expect(result)
        .toContain("HBOS Core");


});