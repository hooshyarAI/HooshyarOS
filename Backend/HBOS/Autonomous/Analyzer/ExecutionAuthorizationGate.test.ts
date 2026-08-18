import { authorizeExecution } from "./ExecutionAuthorizationGate";
describe("Execution authorization gate", () => {
    it("fails closed when any safety precondition is missing", () => {
        expect(authorizeExecution({ evidenceVerified: true, dependenciesSatisfied: true, testsDefined: true, rollbackReady: false })).toBe(false);
    });
    it("authorizes only a fully prepared execution", () => {
        expect(authorizeExecution({ evidenceVerified: true, dependenciesSatisfied: true, testsDefined: true, rollbackReady: true })).toBe(true);
    });
});
