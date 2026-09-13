import { Engine } from "../Core/Engine";
import { ProvenanceTrace } from "../Core/ProvenanceTrace";
import { EngineRegistry } from "./EngineRegistry";

export interface HealthStatus {
    readonly name: string;
    readonly healthy: boolean;
    readonly lastCheck: string;
}

export interface HealthEvent {
    readonly traceId: string;
    readonly engineName: string;
    readonly level: "WARNING" | "CRITICAL" | "OK";
    readonly message: string;
    readonly timestamp: string;
}

export class HealthMonitorEngine implements Engine {
    name = "HealthMonitorEngine";
    private readonly listeners: Array<(event: HealthEvent) => void> = [];
    private initialized = false;

    initialize(): void {
        EngineRegistry.resetInstance();
        this.initialized = true;
    }

    health(): boolean {
        if (!this.initialized) return false;
        const results = EngineRegistry.getInstance().healthCheckAll();
        return results.length === 0 || results.every((r) => r.healthy);
    }

    registerEngine(engine: Engine): void {
        EngineRegistry.getInstance().register(engine);
    }

    unregisterEngine(name: string): void {
        EngineRegistry.getInstance().unregister(name);
    }

    getEngine(name: string): Engine | undefined {
        return EngineRegistry.getInstance().getEngine(name);
    }

    getAllEngines(): Engine[] {
        return EngineRegistry.getInstance().getAllEngines();
    }

    getEngineHealth(name: string): HealthStatus | undefined {
        const engine = this.getEngine(name);
        if (!engine) return undefined;
        return {
            name,
            healthy: true,
            lastCheck: new Date().toISOString()
        };
    }

    getAllHealth(): HealthStatus[] {
        const result: HealthStatus[] = [];
        for (const engine of this.getAllEngines()) {
            const status = this.getEngineHealth(engine.name);
            if (status) result.push(status);
        }
        return result;
    }

    checkAll(): HealthStatus[] {
        const results: HealthStatus[] = [];
        const registry = EngineRegistry.getInstance();
        for (const engine of registry.getAllEngines()) {
            const traceId = ProvenanceTrace.createTraceId();
            const timestamp = new Date().toISOString();
            let healthy = false;
            let level: "WARNING" | "CRITICAL" | "OK" = "OK";
            let message = "Engine " + engine.name + " is healthy";

            try {
                healthy = engine.health();
                if (!healthy) {
                    level = "WARNING";
                    message = "Engine " + engine.name + " returned unhealthy";
                }
            } catch (error) {
                healthy = false;
                level = "CRITICAL";
                message = "Engine " + engine.name + " threw during health check: " + String(error);
            }

            const status: HealthStatus = {
                name: engine.name,
                healthy,
                lastCheck: timestamp
            };

            results.push(status);

            this.emitEvent({
                traceId,
                engineName: engine.name,
                level,
                message,
                timestamp
            });
        }
        return results;
    }

    onHealthEvent(listener: (event: HealthEvent) => void): void {
        this.listeners.push(listener);
    }

    private emitEvent(event: HealthEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch {
                // ignore listener errors
            }
        }
    }
}
