import { AssistantLearningMemory } from "../Core/AssistantLearningMemory";

describe("AssistantLearningMemory", () => {
    test("stores structured lessons and returns reusable learning without turning memory into policy", () => {
        const memory = new AssistantLearningMemory();

        const result = memory.remember({
            id: "lesson-android-sdk-repository",
            cycleId: "productization-001",
            category: "android-release",
            outcome: "FAILURE",
            summary: "Gradle plugin resolution failed after SDK repository fallback.",
            rootCause: "Required Android/Gradle dependencies were not fully resolvable.",
            lesson: "Verify dependency resolution before attempting the final release build.",
            antiPattern: "Do not change dependency versions merely to make a build green.",
            confidence: 0.95,
            provenance: "autonomous-productization",
            timestamp: "2026-08-14T00:00:00Z",
        });

        expect(result.stored).toBe(true);
        expect(memory.size()).toBe(1);
        expect(memory.findReusableLessons("android-release")).toHaveLength(1);
        expect(memory.findReusableLessons("android-release")[0].antiPattern)
            .toContain("Do not change dependency versions");
    });

    test("rejects invalid confidence and missing provenance", () => {
        const memory = new AssistantLearningMemory();

        expect(() => memory.remember({
            id: "invalid",
            cycleId: "cycle",
            category: "test",
            outcome: "FAILURE",
            summary: "invalid",
            confidence: 2,
            provenance: "test",
            timestamp: "2026-08-14T00:00:00Z",
        })).toThrow("confidence");

        expect(() => memory.remember({
            id: "missing-provenance",
            cycleId: "cycle",
            category: "test",
            outcome: "FAILURE",
            summary: "invalid",
            confidence: 0.5,
            provenance: "",
            timestamp: "2026-08-14T00:00:00Z",
        })).toThrow("provenance");
    });
});
