import { EngineLifecycleStatus } from "./EngineLifecycleStatus";

export class EngineLifecycleManager {
    private engines: Map<string, EngineLifecycleStatus>;

    constructor() {
        this.engines = new Map();
    }

    registerEngine(
        engineName: string,
        status: EngineLifecycleStatus = EngineLifecycleStatus.CREATED
    ): void {
        this.engines.set(engineName, status);
    }

    updateStatus(
        engineName: string,
        status: EngineLifecycleStatus
    ): void {
        this.engines.set(engineName, status);
    }

    getStatus(
        engineName: string
    ): EngineLifecycleStatus | undefined {
        return this.engines.get(engineName);
    }
}