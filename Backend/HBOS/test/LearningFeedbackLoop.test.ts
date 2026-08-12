import { LearningFeedbackLoop } from "../Assistant/Autonomous/LearningFeedbackLoop";

describe("LearningFeedbackLoop", () => {
    test("learns a repair lesson from a failed knot", () => {
        const loop = new LearningFeedbackLoop();

        const lesson = loop.learn({
            capabilityId: "platform.example",
            executionOk: false,
            verificationComplete: false,
            repositoryChanged: false,
            recovery: "ROLLBACK",
            failureCode: "VERIFY_FAILED"
        });

        expect(lesson.learned).toBe(true);
        expect(lesson.failureCount).toBe(1);
        expect(lesson.lastFailureCode).toBe("VERIFY_FAILED");
        expect(lesson.preferredRecovery).toBe("ROLLBACK");
        expect(loop.lessonFor("platform.example")).toEqual(lesson);
    });

    test("does not erase a known failure lesson after a successful repair", () => {
        const loop = new LearningFeedbackLoop();

        loop.learn({
            capabilityId: "platform.example",
            executionOk: false,
            verificationComplete: false,
            repositoryChanged: false,
            recovery: "REPAIR",
            failureCode: "GENERATION_FAILED"
        });

        const repaired = loop.learn({
            capabilityId: "platform.example",
            executionOk: true,
            verificationComplete: true,
            repositoryChanged: true,
            recovery: "NONE"
        });

        expect(repaired.failureCount).toBe(1);
        expect(repaired.lastFailureCode).toBe("GENERATION_FAILED");
        expect(repaired.preferredRecovery).toBe("NONE");
        expect(loop.history()).toHaveLength(1);
    });
});
