import { BuilderEventBus } from "../Event/BuilderEventBus";


test("BuilderEventBus should publish events",()=>{


    const bus = new BuilderEventBus();


    bus.publish({

        type:"BUILD_STARTED",

        project:"HooshyarOS"

    });


    const events = bus.getEvents();


    expect(events.length)
    .toBe(1);


    expect(events[0].type)
    .toBe("BUILD_STARTED");


});
