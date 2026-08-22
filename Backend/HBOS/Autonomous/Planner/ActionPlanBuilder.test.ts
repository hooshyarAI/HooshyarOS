import { buildActionPlan } from "./ActionPlanBuilder";
describe("Action plan builder", () => {
 it("keeps blocked actions non-executable", () => expect(buildActionPlan({capability:"Auth",priority:"P0",blockers:["RBAC"],tests:["deny"]}).executable).toBe(false));
 it("makes unblocked plans executable", () => expect(buildActionPlan({capability:"Backup",priority:"P1",blockers:[],tests:["restore"]}).executable).toBe(true));
});
