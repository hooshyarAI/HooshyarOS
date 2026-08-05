import { ProjectRegistry } from "../Services/ProjectRegistry";

import { Project } from "../Entities/Project";
import { ProjectDecision } from "../Entities/ProjectDecision";
import { ProjectInsight } from "../Entities/ProjectInsight";
import { MemoryEvent } from "../Entities/MemoryEvent";

import { DecisionEngine } from "./DecisionEngine";
import { MemoryEngine } from "./MemoryEngine";
import { ReactionEngine } from "./ReactionEngine";


export class ProjectPilotEngine {

    name: string = "ProjectPilotEngine";

    private projectRegistry: ProjectRegistry;

    private decisionEngine: DecisionEngine;

    private memoryEngine: MemoryEngine;

    private reactionEngine: ReactionEngine;


    constructor() {

        this.projectRegistry = new ProjectRegistry();

        this.decisionEngine = new DecisionEngine();

        this.memoryEngine = new MemoryEngine();

        this.reactionEngine = new ReactionEngine();

    }


    initialize(): void {

        console.log("Project Pilot Engine Started");

    }


    health(): boolean {

        return true;

    }


    createProject(
        name: string
    ): Project {

        const project = new Project(name);

        this.projectRegistry.register(project);

        this.memoryEngine.store(

            new MemoryEvent(

                "PROJECT_CREATED",

                name,

                "ProjectPilotEngine"

            )

        );

        return project;

    }


    getProjects(): Project[] {

        return this.projectRegistry.getProjects();

    }


    analyzeProject(
        project: Project
    ): ProjectInsight {

        return new ProjectInsight(

            project.name,

            project.status,

            "Project analysis completed"

        );

    }


    makeDecision(
        project: Project
    ): ProjectDecision {

        return this.decisionEngine.decide(project);

    }

}