// ProjectPilotEngine - Project Lifecycle Management System
// Supporting Component: Manages project lifecycle and coordinates decision/memory/reaction engines

/**
 * ProjectPilotEngine
 * 
 * Role:
 * - Manage projects in system registry
 * - Track project progress and status
 * - Monitor execution progress
 * 
 * Functions:
 * - constructor(): Initialize project registry and component engines
 * - initialize(): Start project pilot engine
 * - health(): Report engine health status
 * - createProject(name): Create and register new project
 * - getProjects(): Retrieve all registered projects
 * - analyzeProject(project): Analyze project state and return insights
 * - makeDecision(project): Generate project decisions using DecisionEngine
 * 
 * Status: Implemented
 * 
 * Note: This engine does NOT implement the Engine interface.
 * It is a supporting component that provides project lifecycle management
 * for the broader HBOS ecosystem. It composes DecisionEngine for decision
 * making, MemoryEngine for event storage, and ReactionEngine for event responses.
 */

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

    createProject(name: string): Project {
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

    analyzeProject(project: Project): ProjectInsight {
        return new ProjectInsight(
            project.name,
            project.status,
            "Project analysis completed"
        );
    }

    makeDecision(project: Project): ProjectDecision {
        return this.decisionEngine.decide(project);
    }
}