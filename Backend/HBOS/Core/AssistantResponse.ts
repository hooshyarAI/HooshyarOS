export class AssistantResponse {


    summary: string;

    recommendation: string;

    confidence: number;

    createdAt: Date;


    constructor(
        summary: string,
        recommendation: string,
        confidence: number
    ) {

        this.summary = summary;

        this.recommendation = recommendation;

        this.confidence = confidence;

        this.createdAt = new Date();

    }


    toText(): string {

        return `
Summary:
${this.summary}

Recommendation:
${this.recommendation}

Confidence:
${this.confidence}
        `.trim();

    }

}