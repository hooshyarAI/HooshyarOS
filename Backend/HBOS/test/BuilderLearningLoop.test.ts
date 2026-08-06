import { BuilderLearningLoop } from "../Builder/Learning/BuilderLearningLoop";

test("Builder Learning Loop stores lessons",()=>{

    const loop = new BuilderLearningLoop();

    loop.learn({
        action:"test",
        result:"success"
    });

    expect(loop.getLessons().length).toBe(1);

});
