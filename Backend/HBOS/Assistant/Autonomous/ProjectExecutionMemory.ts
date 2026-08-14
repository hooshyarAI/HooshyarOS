export type AssistantLearningKind = "SUCCESS_PATTERN" | "FAILURE_PATTERN" | "ANTI_PATTERN" | "LESSON";

export interface AssistantLearningRecord {
    id: string;
    timestamp: string;
    kind: AssistantLearningKind;
    status: string;
    summary: string;
    lesson: string;
    confidence: number;
    evidence: string[];
    tags: string[];
}

export interface AssistantExecutionMemoryInput {
    status?: string;
    completed?: boolean;
    goal?: string;
    lesson?: string;
    summary?: string;
    evidence?: string[];
    tags?: string[];
}

/**
 * Engineering memory for the autonomous assistant.
 *
 * Memory is evidence, not authority: architectural policy, governance and
 * acceptance gates remain the source of truth. The memory deliberately stores
 * structured lessons instead of arbitrary execution payloads so customer data
 * and unrelated runtime state are not copied into the learning history.
 */
export class ProjectExecutionMemory {
    private history: AssistantLearningRecord[] = [];
    private sequence = 0;

    record(data: AssistantExecutionMemoryInput): AssistantLearningRecord {
        const completed = data.completed ?? data.status === "COMPLETED";
        const status = data.status ?? (completed ? "COMPLETED" : "UNKNOWN");
        const kind: AssistantLearningKind = completed ? "SUCCESS_PATTERN" : "FAILURE_PATTERN";
        const summary = data.summary ?? (data.goal ? `Execution outcome for: ${data.goal}` : "Assistant execution outcome");
        const lesson = data.lesson ?? (completed
            ? "Retain the verified execution pattern as reusable evidence."
            : "Do not repeat the failed strategy without new root-cause evidence.");

        const record: AssistantLearningRecord = {
            id: `assistant-learning-${++this.sequence}`,
            timestamp: new Date().toISOString(),
            kind,
            status,
            summary,
            lesson,
            confidence: completed ? 0.8 : 0.6,
            evidence: [...(data.evidence ?? [])],
            tags: [...(data.tags ?? [])],
        };

        this.history.push(record);
        return record;
    }

    learn(record: Omit<AssistantLearningRecord, "id" | "timestamp">): AssistantLearningRecord {
        const stored: AssistantLearningRecord = {
            ...record,
            id: `assistant-learning-${++this.sequence}`,
            timestamp: new Date().toISOString(),
            evidence: [...record.evidence],
            tags: [...record.tags],
        };
        this.history.push(stored);
        return stored;
    }

    learnFromExecution(data: AssistantExecutionMemoryInput): AssistantLearningRecord {
        return this.record(data);
    }

    recall(): AssistantLearningRecord[] {
        return this.history.map((record) => ({
            ...record,
            evidence: [...record.evidence],
            tags: [...record.tags],
        }));
    }

    findLessons(tag?: string): AssistantLearningRecord[] {
        const records = tag ? this.history.filter((record) => record.tags.includes(tag)) : this.history;
        return records.map((record) => ({
            ...record,
            evidence: [...record.evidence],
            tags: [...record.tags],
        }));
    }
}
