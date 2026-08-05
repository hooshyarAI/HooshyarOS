import { Engine } from "./Engine";


export class EngineRegistry {

    private engines: Engine[] = [];


    register(engine: Engine): void {

        this.engines.push(engine);

    }


    initializeAll(): void {

        this.engines.forEach(engine => {

            engine.initialize();

        });

    }


    healthReport() {

        return this.engines.map(engine => ({

            name: engine.name,

            healthy: engine.health()

        }));

    }


    getEngine<T extends Engine>(
        name: string
    ): T | undefined {

        return this.engines.find(
            engine => engine.name === name
        ) as T | undefined;

    }

}