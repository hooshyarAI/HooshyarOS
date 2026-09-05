// Dependency verification mechanism for HooshyarOS engine ecosystem
// Bounded analysis tool - NOT a new Engine
// Detects circular and conflicting dependencies

import fs from "node:fs";
import path from "node:path";

const ENGINES_DIR = path.resolve(__dirname, ".", "Engines");
const HBOS_ROOT = path.resolve(__dirname, ".");

export interface DependencyAnalysis {
    engineName: string;
    importedEngines: string[];
    hasCircularDependency: boolean;
    circularWith?: string;
    dependencyDirection: "INBOUND" | "OUTBOUND" | "NEUTRAL";
    status: "HEALTHY" | "WARNING" | "ERROR";
}

export class EngineDependencyVerifier {
    private engineFiles: string[];
    private importMap: Map<string, string[]> = new Map();

    constructor() {
        this.engineFiles = this.findEngineFiles();
        this.buildImportMap();
    }

    private findEngineFiles(): string[] {
        const files: string[] = [];
        if (!fs.existsSync(ENGINES_DIR)) {
            return files;
        }

        const entries = fs.readdirSync(ENGINES_DIR, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(".ts") && entry.name !== "*.test.ts") {
                files.push(path.join(ENGINES_DIR, entry.name));
            }
        }
        return files;
    }

    private buildImportMap(): void {
        for (const file of this.engineFiles) {
            const content = fs.readFileSync(file, "utf8");
            const engineName = path.basename(file, ".ts");
            const imports = this.extractImports(content);
            this.importMap.set(engineName, imports);
        }
    }

    private extractImports(content: string): string[] {
        const importRegex = /import\s*\{?\s*([^}]+)\}?\s*from\s+["']([^"']+)["']/g;
        const imports: string[] = [];

        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importStatement = match[2];
            if (importStatement.includes(".")) {
                const importedModule = importStatement.split(".")[0];
                if (importedModule.endsWith("Engine")) {
                    imports.push(importedModule);
                }
            }
        }

        // Also match simple imports like "from "./DecisionEngine""
        const simpleImportRegex = /from\s+["'](./[^"']+)["']/g;
        while ((match = simpleImportRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith("./")) {
                const importedEngine = importPath.replace("./", "").replace(/\.ts$/, "");
                if (importedEngine.endsWith("Engine")) {
                    imports.push(importedEngine);
                }
            }
        }

        return [...new Set(imports)]; // Remove duplicates
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

        return circulars;
    }

    public getConflictingDirections(): { engine: string; direction: string }[] {
        const conflicts: { engine: string; direction: string }[] = [];

        for (const [engineName, imports] of this.importMap) {
            const direction = this.analyzeDependencyDirection(engineName, imports);
            if (direction === "INBOUND" && imports.length > 2) {
                conflicts.push({ engine: engineName, direction });
            }
        }

        return conflicts;
    }
}