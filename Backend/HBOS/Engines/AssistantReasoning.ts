import { AssistantContext } from "./AssistantContext";


export class AssistantReasoning {


    analyze(
        context: AssistantContext
    ): string {


        const project =
            context.project;


        const memoryCount =
            context.memories.length;


        if (project.status === "Planning") {

            return `
Project ${project.name} is currently in planning phase.

Memory events:
${memoryCount}

Recommendation:
Define milestones and execution steps.
            `.trim();

        }


        if (project.status === "Active") {

            return `
Project ${project.name} is active.

Memory events:
${memoryCount}

Recommendation:
Monitor progress and evaluate performance.
            `.trim();

        }


        return `
Project ${project.name} status:
${project.status}

Recommendation:
Review project condition.
        `.trim();

    }

}