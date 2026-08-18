import { dependenciesSatisfied } from "./DependencyResolutionGate";
describe("Dependency resolution gate", () => {
    it("requires every dependency to be verified", () => {
        expect(dependenciesSatisfied({ capability: "A", dependencies: ["B", "C"], verified: ["B"] })).toBe(false);
        expect(dependenciesSatisfied({ capability: "A", dependencies: ["B", "C"], verified: ["B", "C"] })).toBe(true);
    });
});
