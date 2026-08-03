import { ReactionEngine } from "../Core/ReactionEngine";
import { MemoryEvent } from "../Core/MemoryEvent";


test("ReactionEngine reacts to project creation event", () => {

    const reaction = new ReactionEngine();


    const event = new MemoryEvent(
        "PROJECT_CREATED",
        "HBOS Core",
        "ProjectPilotEngine"
    );


    const result = reaction.react(event);


    expect(result).toBe(
        "PROJECT_INSIGHT_REQUIRED"
    );

});