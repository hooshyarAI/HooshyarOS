import { HooshyarAutonomousAssistant } from "../Autonomous/HooshyarAutonomousAssistant";
import type { AutonomousRoadmap } from "../../Builder/Autonomous/AutonomousProjectConductor";

export interface AssistantAnalysis {
    project: string;
    status: "ANALYZED";
    roadmap: AutonomousRoadmap;
    nextActions: string[];
}

/**
 * Compatibility facade only.
 * Canonical autonomous authority lives in HooshyarAutonomousAssistant.
 * This class must not own a second runtime, builder, memory, or mission lifecycle.
 */
export class AutonomousAssistant {
    private readonly canonical: HooshyarAutonomousAssistant;

    constructor(_root = process.cwd(), canonical = new HooshyarAutonomousAssistant()) {
        this.canonical = canonical;
    }

    initialize() {
        return {
            name: "AutonomousAssistant",
            status: "READY",
            canonical: "HooshyarAutonomousAssistant"
        };
    }

    analyze(project: string): AssistantAnalysis {
        return {
            project,
            status: "ANALYZED",
            roadmap: {
                inventory: { files: [], directories: [], capabilities: [], builders: [], agents: [], planners: [], repairers: [], tools: [] },
                gaps: [],
                nextAction: null,
                status: "READY"
            },
            nextActions: [
                "delegate execution to canonical autonomous assistant",
                "verify construction evidence",
                "record outcome"
            ]
        };
    }

    execute(task: string) {
        return this.canonical.execute(task);
    }
}
