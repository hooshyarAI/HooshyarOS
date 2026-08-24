import { Project } from "../Entities/Project";
import { MemoryEvent } from "../Entities/MemoryEvent";

export class AssistantContext {
    project: Project;
    memories: MemoryEvent[];
    createdAt: Date;

    constructor(project: Project, memories: MemoryEvent[]) {
        this.project = project;
        this.memories = memories;
        this.createdAt = new Date();
    }

    summary(): string {
        return `
Project: ${this.project.name}

Status: ${this.project.status}

Memory Events: ${this.memories.length}
        `.trim();
    }
}
