import { EngineLifecycleManager } from "../Lifecycle/EngineLifecycleManager";

export class HealthMonitorEngine {

    private lifecycle: EngineLifecycleManager;


    constructor(
        lifecycle: EngineLifecycleManager
    ) {
        this.lifecycle = lifecycle;
    }


    checkEngine(
        engineName: string
    ) {

        const status =
            this.lifecycle.getStatus(engineName);


        return {
            engine: engineName,
            status: status ?? "UNKNOWN",
            healthy: status === "RUNNING"
        };
    }



    generateReport(
        engines: string[]
    ) {

        const report =
            engines.map(
                engine => this.checkEngine(engine)
            );


        const systemHealthy =
            report.every(
                item => item.healthy
            );


        return {

            system:
                systemHealthy
                    ? "READY"
                    : "DEGRADED",

            engines:
                report

        };

    }

}