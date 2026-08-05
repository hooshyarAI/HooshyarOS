import { EngineLifecycleManager } from "../Core/Lifecycle/EngineLifecycleManager";
import { EngineLifecycleStatus } from "../Core/Lifecycle/EngineLifecycleStatus";

describe("Engine Lifecycle Manager", () => {

    test("should register and update engine status", () => {

        const manager = new EngineLifecycleManager();

        manager.registerEngine(
            "Knowledge Engine"
        );

        expect(
            manager.getStatus("Knowledge Engine")
        ).toBe(
            EngineLifecycleStatus.CREATED
        );


        manager.updateStatus(
            "Knowledge Engine",
            EngineLifecycleStatus.RUNNING
        );


        expect(
            manager.getStatus("Knowledge Engine")
        ).toBe(
            EngineLifecycleStatus.RUNNING
        );

    });

});