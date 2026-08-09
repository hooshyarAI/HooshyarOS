import { AutonomousMemoryEngine } from "../Engines/AutonomousMemoryEngine";


describe("AutonomousMemoryEngine",()=>{

    test("should store autonomous runtime memory records",()=>{

        const engine = new AutonomousMemoryEngine();

        engine.initialize();


        const result = engine.remember({
            cycleId:"cycle-001",
            commit:"fa9cf449",
            status:"AUTONOMOUS_COMPLETE",
            timestamp:"2026-08-09"
        });


        expect(result.stored).toBe(true);

        expect(engine.getHistory().length).toBe(1);

        expect(engine.getHistory()[0].commit)
            .toBe("fa9cf449");

    });


});
