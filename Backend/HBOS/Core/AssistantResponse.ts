import { TruthfulConfidence } from "./IntelligenceContract";

export class AssistantResponse {


    summary: string;

    recommendation: string;

    confidence: TruthfulConfidence;

    createdAt: Date;


    constructor(
        summary: string,
        recommendation: string,
        confidence: TruthfulConfidence
    ) {

        this.summary = summary;

        this.recommendation = recommendation;

        this.confidence = confidence;

        this.createdAt = new Date();

    }

    get numericConfidence(): number | undefined {
        if (this.confidence.source === "unavailable") {
            return undefined;
        }
        return this.confidence.value;
    }


    toText(): string {

        const confidenceDisplay = this.numericConfidence !== undefined
            ? `${(this.numericConfidence * 100).toFixed(1)}%`
            : "unavailable";

        return `
Summary:
${this.summary}

Recommendation:
${this.recommendation}

Confidence:
${confidenceDisplay}
        `.trim();

    }

}
