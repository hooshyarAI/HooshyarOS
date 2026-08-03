import { KnowledgeEngine } from "../Engines/KnowledgeEngine";
import { MemoryEvent } from "../Entities/MemoryEvent";

test("KnowledgeEngine learns from memory event", () => {

    const engine =
        new KnowledgeEngine();


    const event =
        new MemoryEvent(
            "PROJECT_CREATED",
            "ProjectPilot",
            "HBOS Core"
        );


    const knowledge =
        engine.learn(
            event
        );


    expect(knowledge.title)
        .toBe("PROJECT_CREATED");


    expect(engine.count())
        .toBe(1);

});