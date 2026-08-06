import {BuilderLifecycleManager}
from "../Builder/Lifecycle/BuilderLifecycleManager";


test("Builder lifecycle should reach READY",()=>{


    const manager =
        new BuilderLifecycleManager();


    manager.start();

    manager.complete();


    expect(
        manager.getStatus()
    )
    .toBe("READY");


});