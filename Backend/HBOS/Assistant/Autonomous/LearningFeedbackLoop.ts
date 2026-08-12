export interface WeavingFeedback {
    capabilityId: string;
    executionOk: boolean;
    verificationComplete: boolean;
    repositoryChanged: boolean;
    recovery?: "NONE" | "ROLLBACK" | "REPAIR";
    failureCode?: string;
}

export interface WeavingLesson {
    capabilityId: string;
    learned: true;
    failureCount: number;
    lastFailureCode?: string;
    preferredRecovery: "NONE" | "ROLLBACK" | "REPAIR";
}

/**
 * Durable in-process feedback memory for autonomous construction.
 *
 * A failed knot becomes a reusable lesson: later attempts can prefer the
 * recovery mode that already proved necessary instead of blindly repeating
 * the same construction path.
 */
export class LearningFeedbackLoop {
    private readonly lessons = new Map<string, WeavingLesson>();

    learn(feedback: WeavingFeedback): WeavingLesson {
        const previous = this.lessons.get(feedback.capabilityId);
        const failure = !(feedback.executionOk && feedback.verificationComplete && feedback.repositoryChanged);
        const lesson: WeavingLesson = {
            capabilityId: feedback.capabilityId,
            learned: true,
            failureCount: (previous?.failureCount ?? 0) + (failure ? 1 : 0),
            lastFailureCode: failure ? feedback.failureCode : previous?.lastFailureCode,
            preferredRecovery: failure
                ? (feedback.recovery === "NONE" ? "REPAIR" : feedback.recovery ?? "REPAIR")
                : "NONE"
        };
        this.lessons.set(feedback.capabilityId, lesson);
        return lesson;
    }

    lessonFor(capabilityId: string): WeavingLesson | undefined {
        return this.lessons.get(capabilityId);
    }

    history(): WeavingLesson[] {
        return [...this.lessons.values()].map(lesson => ({ ...lesson }));
    }
}
