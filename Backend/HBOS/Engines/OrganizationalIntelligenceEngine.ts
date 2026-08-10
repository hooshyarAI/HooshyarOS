import { Engine } from "../Core/Engine";
import { MemoryEngine } from "./MemoryEngine";
import { KnowledgeEngine } from "./KnowledgeEngine";
import { ProjectPilotEngine } from "./ProjectPilotEngine";

export interface OrganizationalInsight {
    scope: string;
    status: "READY";
    projectCount: number;
    healthy: boolean;
}

/** Canonical organizational intelligence owner; composes existing project, memory and knowledge owners. */
export class OrganizationalIntelligenceEngine implements Engine {
    name = "OrganizationalIntelligenceEngine";
    private readonly memory = new MemoryEngine();
    private readonly knowledge = new KnowledgeEngine();
    private readonly projects = new ProjectPilotEngine();

    initialize(): void {
        this.memory.initialize();
        this.knowledge.initialize();
        this.projects.initialize();
        console.log("OrganizationalIntelligenceEngine Started");
    }

    health(): boolean {
        return true;
    }

    assess(scope = "organization"): OrganizationalInsight {
        return {
            scope,
            status: "READY",
            projectCount: this.projects.getProjects().length,
            healthy: this.health()
        };
    }
}
