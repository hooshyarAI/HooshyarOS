import { ProjectRegistry } from "./ProjectRegistry";
import { Project } from "./Project";
import { DecisionEngine } from "./DecisionEngine";
import { ProjectDecision } from "./ProjectDecision";
import { ProjectInsight } from "./ProjectInsight";
import { MemoryEngine, MEMORY_INTERNAL_SCOPE } from "./MemoryEngine";
import { MemoryEvent } from "./MemoryEvent";
import { ReactionEngine } from "./ReactionEngine";


export class ProjectPilotEngine {

    name: string = "ProjectPilotEngine";

    private registry: ProjectRegistry;

    private decisionEngine: DecisionEngine;

    private memoryEngine: MemoryEngine;

    private reactionEngine: ReactionEngine;


    constructor() {

        this.registry = new ProjectRegistry();

        this.decisionEngine = new DecisionEngine();

        this.memoryEngine = new MemoryEngine();

        this.reactionEngine = new ReactionEngine();


        this.memoryEngine.subscribe(
            this.reactionEngine
        );

    }


    initialize(): void {

        console.log("Project Pilot Engine Started");

    }


    health(): boolean {

        return true;

    }


    createProject(name: string): void {

        this.registry.addProject(name);


        const event = new MemoryEvent(
            "PROJECT_CREATED",
            name,
            this.name
        );


        this.memoryEngine.store(event, MEMORY_INTERNAL_SCOPE);

    }


    getProjects(): Project[] {

        return this.registry.listProjects();

    }


    getProjectDecision(project: Project): ProjectDecision {

        return this.decisionEngine.evaluateProject(project.status);

    }


    getProjectInsight(project: Project): ProjectInsight {

        const decision = this.getProjectDecision(project);


        return new ProjectInsight(
            project.name,
            project.status,
            decision.message
        );

    }


    getMemory(): MemoryEvent[] {

        return this.memoryEngine.retrieve(MEMORY_INTERNAL_SCOPE);

    }

}