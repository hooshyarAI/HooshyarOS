import { ProjectStatus } from "./ProjectStatus";
import { DecisionContext } from "../Core/DecisionContext";


export class ProjectDecision {

    status: ProjectStatus;

    message: string;

    // === Evidence/Provenance fields (additive) ===
    /** Trace identifier from reasoning, undefined if unavailable */
    readonly traceId?: string;
    /** Hash of input that was processed, undefined if unavailable */
    readonly inputHash?: string;
    /** Reference to reasoning result, undefined if unavailable */
    readonly reasoningRef?: string;
    /** Explanation of reasoning, undefined if unavailable */
    readonly explanation?: string;
    /** Confidence score [0,1] when known, undefined if unavailable */
    readonly confidence?: number;
    /** Known limitations, undefined if unavailable */
    readonly limitations?: readonly string[];


    constructor(status: ProjectStatus, message: string, evidence?: DecisionContext) {

        this.status = status;

        this.message = message;

        // Preserve evidence only when provided - never fabricate
        this.traceId = evidence?.traceId;
        this.inputHash = evidence?.inputHash;
        this.reasoningRef = evidence?.reasoningRef;
        this.explanation = evidence?.explanation;
        this.confidence = evidence?.confidence;
        this.limitations = evidence?.limitations;

    }

}
