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

export interface LegacyLearningResult {
    learned: true;
    result: unknown;
}

/**
 * Durable in-process feedback memory for autonomous construction.
 *
 * A failed knot becomes a reusable lesson: later attempts can prefer the
 * recovery mode that already proved necessary instead of blindly repeating
 * the same construction path.
 *
 * The legacy learn(result) contract remains supported so existing Assistant
 * consumers do not break while structured weaving feedback is introduced.
 */
export class LearningFeedbackLoop {
    private readonly lessons = new Map<string, WeavingLesson>();

    learn(feedback: WeavingFeedback): WeavingLesson;
    learn(result: unknown): LegacyLearningResult;
    learn(input: WeavingFeedback | unknown): WeavingLesson | LegacyLearningResult {
        if (!this.isWeavingFeedback(input)) {
            return { learned: true, result: input };
        }

        const previous = this.lessons.get(input.capabilityId);
        const failure = !(input.executionOk && input.verificationComplete && input.repositoryChanged);
        const lesson: WeavingLesson = {
            capabilityId: input.capabilityId,
            learned: true,
            failureCount: (previous?.failureCount ?? 0) + (failure ? 1 : 0),
            lastFailureCode: failure ? input.failureCode : previous?.lastFailureCode,
            preferredRecovery: failure
                ? (input.recovery === "NONE" ? "REPAIR" : input.recovery ?? "REPAIR")
                : "NONE"
        };
        this.lessons.set(input.capabilityId, lesson);
        return lesson;
    }

    lessonFor(capabilityId: string): WeavingLesson | undefined {
        return this.lessons.get(capabilityId);
    }

    history(): WeavingLesson[] {
        return [...this.lessons.values()].map(lesson => ({ ...lesson }));
    }

    private isWeavingFeedback(input: unknown): input is WeavingFeedback {
        if (!input || typeof input !== "object") return false;
        const candidate = input as Partial<WeavingFeedback>;
        return typeof candidate.capabilityId === "string"
            && typeof candidate.executionOk === "boolean"
            && typeof candidate.verificationComplete === "boolean"
            && typeof candidate.repositoryChanged === "boolean";
    }
}
