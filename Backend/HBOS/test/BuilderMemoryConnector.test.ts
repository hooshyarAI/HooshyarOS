import { BuilderMemoryConnector } from "../Builder/Memory/BuilderMemoryConnector";


test("BuilderMemoryConnector should store events",()=>{


    const memory = new BuilderMemoryConnector();


    memory.remember({

        type:"BUILD_COMPLETED",

        project:"HooshyarOS"

    });


    const result = memory.getMemories();


    expect(result.length)
    .toBe(1);


    expect(result[0].project)
    .toBe("HooshyarOS");


});
