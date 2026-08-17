import { existsSync } from "node:fs";
import { CapabilityEvidence } from "./CapabilityGateEvaluator";

export interface CapabilityDefinition {
    name: string;
    requiredPaths: string[];
    documented?: boolean;
}

export interface DiscoveredCapability {
    name: string;
    evidence: CapabilityEvidence[];
    missingPaths: string[];
}

export class CapabilityDiscovery {
    constructor(private readonly rootPath: string) {}

    discover(definitions: CapabilityDefinition[]): DiscoveredCapability[] {
        return definitions.map((definition) => {
            const missingPaths = definition.requiredPaths.filter(
                (path) => !existsSync(`${this.rootPath}/${path}`)
            );
            const implemented = missingPaths.length === 0;
            return {
                name: definition.name,
                missingPaths,
                evidence: [
                    { stage: "DOCUMENTED", verified: definition.documented === true },
                    { stage: "IMPLEMENTED", verified: implemented },
                ],
            };
        });
    }
}
