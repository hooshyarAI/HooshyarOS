import { AgentRunner } from "../Runtime/AgentRunner";

import { TaskManager } from "../Runtime/TaskManager";

import { WorkflowEngine } from "../Runtime/WorkflowEngine";


describe("AI Runtime",()=>{


test("agent should execute task",()=>{


const agent=new AgentRunner();


const result=
agent.run(
"DeveloperAgent",
"Create Engine"
);


expect(result.status)
.toBe("EXECUTED");


});


test("task manager works",()=>{


const manager=
new TaskManager();


manager.add("Build Engine");


expect(
manager.getTasks().length
)
.toBe(1);


});


test("workflow execution",()=>{


const engine=
new WorkflowEngine();


const result=
engine.execute(
"Feature"
);


expect(
result.steps.length
)
.toBe(4);


});


});