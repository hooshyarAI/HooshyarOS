import { EngineDependencyManager } from "../Core/Dependency/EngineDependencyManager";


describe(
    "Engine Dependency Manager",
    () => {


        test(
            "should validate engine dependencies",
            () => {


                const manager =
                    new EngineDependencyManager();



                manager.registerDependency(
                    "Assistant Engine",
                    [
                        "Memory Engine",
                        "Knowledge Engine"
                    ]
                );



                const result =
                    manager.validate(
                        "Assistant Engine",
                        [
                            "Memory Engine",
                            "Knowledge Engine",
                            "Decision Engine"
                        ]
                    );



                expect(result)
                    .toBe(true);


            }
        );


    }
);