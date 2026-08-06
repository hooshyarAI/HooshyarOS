import { BuilderAutonomousController } from "../Builder/Controller/BuilderAutonomousController";


test("BuilderAutonomousController should prepare build flow",()=>{


    const controller = new BuilderAutonomousController();


    const result = controller.run({

        project:"HooshyarOS"

    });


    expect(result.received)
    .toBe(true);


    expect(result.status)
    .toBe("READY");


});
