import { ProjectRegistry } from "./ProjectRegistry";
import { Project } from "./Project";
import { DecisionEngine } from "./DecisionEngine";
import { ProjectDecision } from "./ProjectDecision";
import { ProjectInsight } from "./ProjectInsight";


export class ProjectPilotEngine {

    name: string = "ProjectPilotEngine";

    private registry: ProjectRegistry;

    private decisionEngine: DecisionEngine;


    constructor() {

        this.registry = new ProjectRegistry();

        this.decisionEngine = new DecisionEngine();

    }


    initialize(): void {

        console.log("Project Pilot Engine Started");

    }


    health(): boolean {

        return true;

    }


    createProject(name: string): void {

        this.registry.addProject(name);

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

}