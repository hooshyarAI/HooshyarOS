import { EngineDependencyManager } from "./EngineDependencyManager";


export class BootDependencyValidator {


    private dependencyManager:
        EngineDependencyManager;



    constructor(
        dependencyManager:
        EngineDependencyManager
    ) {

        this.dependencyManager =
            dependencyManager;

    }



    canBoot(
        engine: string,
        availableEngines: string[]
    ): boolean {


        return this.dependencyManager.validate(
            engine,
            availableEngines
        );

    }


}