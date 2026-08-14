import { ProjectExecutionMemory } from "../Assistant/Autonomous/ProjectExecutionMemory";

describe("ProjectExecutionMemory", () => {
    it("learns from failed executions without storing the raw execution payload", () => {
        const memory = new ProjectExecutionMemory();
        const result = memory.learnFromExecution({
            status: "BLOCKED",
            completed: false,
            goal: "productize release",
            summary: "Release packaging was blocked by dependency provisioning.",
            lesson: "Repair the provisioning boundary before retrying packaging.",
            evidence: ["builder log", "release gate"],
            tags: ["productization", "repair"],
        });

        expect(result.kind).toBe("FAILURE_PATTERN");
        expect(result.lesson).toContain("provisioning boundary");
        expect(memory.recall()).toEqual([result]);
        expect(JSON.stringify(memory.recall())).not.toContain("raw execution payload");
    });

    it("preserves successful patterns and supports lesson retrieval by tag", () => {
        const memory = new ProjectExecutionMemory();
        memory.learn({
            kind: "SUCCESS_PATTERN",
            status: "COMPLETED",
            summary: "Verification completed after governed repair.",
            lesson: "Reuse the verified repair sequence when evidence remains applicable.",
            confidence: 0.9,
            evidence: ["focused test", "acceptance result"],
            tags: ["repair", "verification"],
        });

        const lessons = memory.findLessons("repair");
        expect(lessons).toHaveLength(1);
        expect(lessons[0].kind).toBe("SUCCESS_PATTERN");
        expect(lessons[0].confidence).toBe(0.9);
    });
});
