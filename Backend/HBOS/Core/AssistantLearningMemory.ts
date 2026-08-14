export type AssistantLearningOutcome = "SUCCESS" | "FAILURE" | "PARTIAL";

export interface AssistantLearningRecord {
    id: string;
    cycleId: string;
    category: string;
    outcome: AssistantLearningOutcome;
    summary: string;
    rootCause?: string;
    lesson?: string;
    antiPattern?: string;
    successfulPattern?: string;
    confidence: number;
    provenance: string;
    timestamp: string;
}

export class AssistantLearningMemory {
    private readonly records: AssistantLearningRecord[] = [];

    remember(record: AssistantLearningRecord): { stored: boolean; record: AssistantLearningRecord } {
        if (record.confidence < 0 || record.confidence > 1) {
            throw new Error("Assistant learning confidence must be between 0 and 1");
        }

        if (!record.id || !record.cycleId || !record.category || !record.summary || !record.provenance) {
            throw new Error("Assistant learning record is missing required provenance fields");
        }

        const existing = this.records.find((item) => item.id === record.id);
        if (existing) {
            return { stored: false, record: existing };
        }

        this.records.push({ ...record });
        return { stored: true, record };
    }

    recall(category?: string): AssistantLearningRecord[] {
        const records = category
            ? this.records.filter((record) => record.category === category)
            : this.records;

        return records.map((record) => ({ ...record }));
    }

    findReusableLessons(category?: string): AssistantLearningRecord[] {
        return this.recall(category).filter(
            (record) => record.lesson && (record.successfulPattern || record.antiPattern),
        );
    }

    size(): number {
        return this.records.length;
    }
}
