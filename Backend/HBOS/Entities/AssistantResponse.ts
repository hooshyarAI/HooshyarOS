import { Project } from "./Project";
import { DecisionContext } from "../Core/DecisionContext";


export class AssistantResponse {

    project: Project;

    message: string;

    /** Confidence from actual evidence, undefined when unavailable */
    confidence: number | undefined;

    // === Evidence/Provenance fields (additive) ===
    /** Trace identifier from reasoning, undefined if unavailable */
    readonly traceId?: string;
    /** Hash of input that was processed, undefined if unavailable */
    readonly inputHash?: string;
    /** Reference to reasoning result, undefined if unavailable */
    readonly reasoningRef?: string;
    /** Explanation of reasoning, undefined if unavailable */
    readonly explanation?: string;
    /** Known limitations, undefined if unavailable */
    readonly limitations?: readonly string[];


    constructor(
        project: Project,
        message: string,
        confidence: number | undefined,
        evidence?: DecisionContext
    ) {
        this.project = project;
        this.message = message;
        this.confidence = confidence;
        // Preserve evidence only when provided - never fabricate
        this.traceId = evidence?.traceId;
        this.inputHash = evidence?.inputHash;
        this.reasoningRef = evidence?.reasoningRef;
        this.explanation = evidence?.explanation;
        this.limitations = evidence?.limitations;
    }

}
