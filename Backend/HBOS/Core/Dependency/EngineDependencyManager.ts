import { EngineDependency } from "./EngineDependency";


export class EngineDependencyManager {


    private dependencies:
        Map<string, string[]>;



    constructor() {

        this.dependencies = new Map();

    }



    registerDependency(
        engine: string,
        dependsOn: string[]
    ): void {


        this.dependencies.set(
            engine,
            dependsOn
        );

    }



    getDependencies(
        engine: string
    ): string[] {


        return (
            this.dependencies.get(engine)
            ?? []
        );

    }



    validate(
        engine: string,
        availableEngines: string[]
    ): boolean {


        const required =
            this.getDependencies(engine);



        return required.every(
            dependency =>
                availableEngines.includes(
                    dependency
                )
        );

    }


}