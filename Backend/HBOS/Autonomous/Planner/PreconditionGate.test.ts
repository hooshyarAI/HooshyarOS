import { evaluatePreconditions } from "./PreconditionGate";
describe("Precondition gate", () => {
 it("blocks when any prerequisite is false", () => expect(evaluatePreconditions({tests:true,security:false})).toEqual({ready:false,blockers:["security"]}));
 it("opens only when all prerequisites pass", () => expect(evaluatePreconditions({tests:true,security:true})).toEqual({ready:true,blockers:[]}));
});
