import { AssistantContext } from "../Core/AssistantContext";

export class AssistantReasoning {
    analyze(context: AssistantContext): string {
        const project = context.project;
        const memoryCount = context.memories.length;
        if (project.status === "Planning") return `Project ${project.name} is currently in planning phase.\n\nMemory events:\n${memoryCount}\n\nRecommendation:\nDefine milestones and execution steps.`.trim();
        if (project.status === "Active") return `Project ${project.name} is active.\n\nMemory events:\n${memoryCount}\n\nRecommendation:\nMonitor progress and evaluate performance.`.trim();
        return `Project ${project.name} status:\n${project.status}\n\nRecommendation:\nReview project condition.`.trim();
    }
}
