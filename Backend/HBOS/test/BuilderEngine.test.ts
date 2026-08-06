import { BuilderEngine } from "../Builder/Core/BuilderEngine";

describe("BuilderEngine",()=>{

test("builder should initialize",()=>{

const builder = new BuilderEngine();

expect(
builder.build("HooshyarOS").status
)
.toBe("READY");

});

});
