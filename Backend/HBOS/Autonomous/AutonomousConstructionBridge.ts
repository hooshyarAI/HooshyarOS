import { AutonomousDevelopmentLoop } from "../Architecture/Autonomous/AutonomousDevelopmentLoop";
import { createLocalConstructionTools } from "./Runtime/LocalConstructionToolset";
import { ConstructionTool } from "../Builder/Autonomous/AutonomousConstructionEngine";

export interface ProjectInventory { files: string[]; capabilities: string[]; }
export interface ProjectGap { capabilityId: string; capability: string; targetEngine: string; }

/**
 * Bridges the mission controller to the governed autonomous construction loop.
 *
 * The previous parallel build loop (AutonomousBuilderLoop / AutonomousBuildSupervisor)
 * was a duplicate of AutonomousDevelopmentLoop and has been retired. Construction now
 * delegates to the single canonical loop (AutonomousDevelopmentLoop) through the
 * unified Kilo/Python LocalConstructionToolset. This file retains gap inspection for
 * the autonomous-self-healing capability and remains referenced by the completion gate.
 */
export class AutonomousConstructionBridge {
    constructor(private readonly tools?: ConstructionTool[]) {}

    inspect(inventory: ProjectInventory): ProjectGap[] {
        const known = new Set(inventory.capabilities);
        const gaps: ProjectGap[] = [];
        if (!known.has("autonomous-self-healing")) {
            gaps.push({ capabilityId: "autonomous-self-healing", capability: "platform self-healing", targetEngine: "Autonomous Operations Engine" });
        }
        return gaps;
    }

    execute(inventory: ProjectInventory, tools: ConstructionTool[] = createLocalConstructionTools()): ReturnType<AutonomousDevelopmentLoop["execute"]>[] {
        const loop = new AutonomousDevelopmentLoop(tools);
        return this.inspect(inventory).map(gap => loop.execute(gap));
    }

    static selfTest(): void {
        const tools: ConstructionTool[] = [
            { name: "architecture", execute: () => ({ ok: true }) },
            { name: "python", execute: () => ({ ok: true }) },
            { name: "git", execute: () => ({ ok: true }) }
        ];
        const bridge = new AutonomousConstructionBridge();
        const result = bridge.execute({ files: [], capabilities: [] }, tools);
        if (result.length !== 1 || result[0].status !== "completed") {
            throw new Error("AutonomousConstructionBridge self-test failed");
        }
    }
}
