import { Engine } from "../Core/Engine";

export class EngineRegistry {
    private static instance: EngineRegistry | null = null;
    private readonly engines = new Map<string, Engine>();
    private readonly healthStatus = new Map<string, { healthy: boolean; lastCheck: string }>();

    private constructor() {}

    static getInstance(): EngineRegistry {
        if (!EngineRegistry.instance) {
            EngineRegistry.instance = new EngineRegistry();
        }
        return EngineRegistry.instance;
    }

    static resetInstance(): void {
        EngineRegistry.instance = new EngineRegistry();
    }

    register(engine: Engine): void {
        if (this.engines.has(engine.name)) {
            throw new Error("Engine " + engine.name + " already registered");
        }
        this.engines.set(engine.name, engine);
    }

    unregister(name: string): void {
        this.engines.delete(name);
        this.healthStatus.delete(name);
    }

    getEngine(name: string): Engine | undefined {
        return this.engines.get(name);
    }

    getAllEngines(): Engine[] {
        return Array.from(this.engines.values());
    }

    healthCheckAll(): { name: string; healthy: boolean; lastCheck: string }[] {
        const results: { name: string; healthy: boolean; lastCheck: string }[] = [];
        for (const engine of this.engines.values()) {
            const timestamp = new Date().toISOString();
            let healthy = false;
            try {
                healthy = engine.health();
            } catch {
                healthy = false;
            }
            results.push({ name: engine.name, healthy, lastCheck: timestamp });
        }
        return results;
    }
}
