import { EngineDependencyManager } 
from "../Core/Dependency/EngineDependencyManager";

import { BootDependencyValidator }
from "../Core/Dependency/BootDependencyValidator";


describe(
"Boot Dependency Validator",
()=>{


test(
"should allow boot when dependencies exist",
()=>{


const dependencyManager =
new EngineDependencyManager();



dependencyManager.registerDependency(
"Assistant Engine",
[
"Memory Engine",
"Knowledge Engine"
]
);



const validator =
new BootDependencyValidator(
dependencyManager
);



const result =
validator.canBoot(
"Assistant Engine",
[
"Memory Engine",
"Knowledge Engine",
"Decision Engine"
]
);



expect(result)
.toBe(true);



});



});