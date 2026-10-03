// Dependency verification mechanism for HooshyarOS engine ecosystem
// Bounded analysis tool - NOT a new Engine
// Detects circular and conflicting dependencies

import fs from "node:fs";
import path from "node:path";

// Canonical engine location in Architecture Freeze V4.1 is Backend/HBOS/Engines,
// which is a sibling of this file's directory (Core/). Resolving from __dirname
// keeps the verifier correct under ts-jest and any other in-tree runner.
const DEFAULT_ENGINES_DIR = path.resolve(__dirname, "..", "Engines");

export interface DependencyAnalysis {
    engineName: string;
    importedEngines: string[];
    hasCircularDependency: boolean;
    circularWith?: string;
    dependencyDirection: "INBOUND" | "OUTBOUND" | "NEUTRAL";
    status: "HEALTHY" | "WARNING" | "ERROR";
}

export class EngineDependencyVerifier {
    public readonly enginesDir: string;
    private engineFiles: string[];
    private engineNames: Set<string> = new Set();
    private importMap: Map<string, string[]> = new Map();

    constructor(enginesDir: string = DEFAULT_ENGINES_DIR) {
        this.enginesDir = path.resolve(enginesDir);
        this.engineFiles = this.findEngineFiles();
        this.buildImportMap();
    }

    private findEngineFiles(): string[] {
        if (!fs.existsSync(this.enginesDir) || !fs.statSync(this.enginesDir).isDirectory()) {
            throw new Error(
                `EngineDependencyVerifier: canonical engines directory not found: ${this.enginesDir}`
            );
        }

        const entries = fs.readdirSync(this.enginesDir, { withFileTypes: true });
        const files = entries
            .filter(entry => entry.isFile())
            .map(entry => entry.name)
            .filter(name => name.endsWith("Engine.ts") && !name.endsWith(".test.ts"))
            .map(name => path.join(this.enginesDir, name))
            .sort();

        if (files.length === 0) {
            throw new Error(
                `EngineDependencyVerifier: no engine files found in ${this.enginesDir}; refusing to report an empty analysis`
            );
        }

        return files;
    }

    private buildImportMap(): void {
        this.engineNames = new Set(
            this.engineFiles.map(file => path.basename(file, ".ts"))
        );

        for (const file of this.engineFiles) {
            const content = fs.readFileSync(file, "utf8");
            const engineName = path.basename(file, ".ts");
            const imports = this.extractImports(content, engineName);
            this.importMap.set(engineName, imports);
        }
    }

    private extractImports(content: string, selfName: string): string[] {
        const importRegex = /(?:^|\n)\s*(?:import|export)\b[\s\S]*?from\s+["']([^"']+)["']/g;
        const imports = new Set<string>();

        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(content)) !== null) {
            const specifier = match[1];
            const importedEngine = path.basename(specifier).replace(/\.ts$/, "");
            if (importedEngine !== selfName && this.engineNames.has(importedEngine)) {
                imports.add(importedEngine);
            }
        }

        return [...imports].sort();
    }

    public analyzeDependencies(): DependencyAnalysis[] {
        const results: DependencyAnalysis[] = [];

        for (const [engineName, imports] of this.importMap) {
            const circularWith = this.detectCircularDependency(engineName, imports);
            const dependencyDirection = this.analyzeDependencyDirection(engineName, imports);

            results.push({
                engineName,
                importedEngines: imports,
                hasCircularDependency: !!circularWith,
                circularWith,
                dependencyDirection,
                status: this.determineStatus(circularWith, imports)
            });
        }

        return results;
    }

    private detectCircularDependency(engineName: string, imports: string[]): string | undefined {
        for (const imported of imports) {
            const importedImports = this.importMap.get(imported) || [];
            if (importedImports.includes(engineName)) {
                return imported;
            }
        }
        return undefined;
    }

    private analyzeDependencyDirection(engineName: string, imports: string[]): "INBOUND" | "OUTBOUND" | "NEUTRAL" {
        // Check if engine is imported by others (has inbound dependencies)
        let hasInbound = false;
        let hasOutbound = imports.length > 0;

        for (const [otherEngine, otherImports] of this.importMap) {
            if (otherEngine !== engineName && otherImports.includes(engineName)) {
                hasInbound = true;
            }
        }

        if (hasInbound && hasOutbound) {
            return "NEUTRAL";
        } else if (hasInbound) {
            return "INBOUND";
        } else if (hasOutbound) {
            return "OUTBOUND";
        }
        return "NEUTRAL";
    }

    private determineStatus(circularWith: string | undefined, imports: string[]): "HEALTHY" | "WARNING" | "ERROR" {
        if (circularWith) {
            return "ERROR";
        }
        if (imports.length === 0) {
            return "WARNING";
        }
        return "HEALTHY";
    }

    public getCircularDependencies(): string[] {
        const circulars: string[] = [];

        for (const [engineName, imports] of this.importMap) {
            for (const imported of imports) {
                const importedImports = this.importMap.get(imported) || [];
                if (importedImports.includes(engineName)) {
                    const pair = [engineName, imported].sort().join(" <-> ");
                    if (!circulars.includes(pair)) {
                        circulars.push(pair);
                    }
                }
            }
        }

        return circulars.sort();
    }

    public getConflictingDirections(): { engine: string; direction: string }[] {
        const conflicts: { engine: string; direction: string }[] = [];

        for (const [engineName, imports] of this.importMap) {
            const direction = this.analyzeDependencyDirection(engineName, imports);
            // A conflicting direction is an engine that both consumes and is
            // consumed by peers (NEUTRAL) while carrying a wide outbound surface.
            // The prior condition (INBOUND && imports.length > 2) was provably
            // unreachable because INBOUND implies zero outbound imports.
            if (direction === "NEUTRAL" && imports.length > 2) {
                conflicts.push({ engine: engineName, direction });
            }
        }

        return conflicts.sort((a, b) => a.engine.localeCompare(b.engine));
    }
}
