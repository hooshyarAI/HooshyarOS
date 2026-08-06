import { BuilderProjectConnector }
from "../Builder/Project/BuilderProjectConnector";

import { ProjectRegistry }
from "../Registry/ProjectRegistry";


test(
"Builder should register created project",
()=>{

const registry =
new ProjectRegistry();


const connector =
new BuilderProjectConnector(registry);


const project =
connector.createProject("HooshyarOS");


expect(project.name)
.toBe("HooshyarOS");


expect(
registry.find("HooshyarOS")
)
.toBeDefined();


});