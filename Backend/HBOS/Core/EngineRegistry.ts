export interface Engine {

    name: string;

    initialize(): void;

    health(): boolean;

}

export class EngineRegistry {

    private engines: Engine[] = [];

    register(engine: Engine): void {

        this.engines.push(engine);

    }

    initializeAll(): void {

        this.engines.forEach(engine => engine.initialize());

    }

    healthReport() {

        return this.engines.map(engine => ({

            engine: engine.name,

            healthy: engine.health()

        }));

    }

}