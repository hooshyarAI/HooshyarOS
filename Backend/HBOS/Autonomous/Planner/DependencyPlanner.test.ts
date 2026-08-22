import { planDependencyOrder } from "./DependencyPlanner";
describe("Dependency planner", () => {
 it("orders prerequisites first", () => expect(planDependencyOrder([{capability:"B",dependencies:["A"]},{capability:"A",dependencies:[]}])).toEqual(["A","B"]));
 it("blocks cycles", () => expect(() => planDependencyOrder([{capability:"A",dependencies:["B"]},{capability:"B",dependencies:["A"]}])).toThrow("DEPENDENCY_CYCLE_OR_MISSING_CAPABILITY"));
});
