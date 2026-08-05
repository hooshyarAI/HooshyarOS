import { HealthMonitorEngine } from "../Core/Health/HealthMonitorEngine";
import { EngineLifecycleManager } from "../Core/Lifecycle/EngineLifecycleManager";
import { EngineLifecycleStatus } from "../Core/Lifecycle/EngineLifecycleStatus";


describe("Health Monitor Engine", () => {


    test("should generate healthy system report", () => {


        const lifecycle =
            new EngineLifecycleManager();



        lifecycle.registerEngine(
            "Memory Engine"
        );


        lifecycle.registerEngine(
            "Knowledge Engine"
        );



        lifecycle.updateStatus(
            "Memory Engine",
            EngineLifecycleStatus.RUNNING
        );


        lifecycle.updateStatus(
            "Knowledge Engine",
            EngineLifecycleStatus.RUNNING
        );



        const monitor =
            new HealthMonitorEngine(
                lifecycle
            );



        const report =
            monitor.generateReport(
                [
                    "Memory Engine",
                    "Knowledge Engine"
                ]
            );



        expect(report.system)
            .toBe("READY");



        expect(
            report.engines.length
        )
            .toBe(2);



        expect(
            report.engines[0].healthy
        )
            .toBe(true);


    });


});