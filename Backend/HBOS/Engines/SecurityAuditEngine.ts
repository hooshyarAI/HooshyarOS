import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Engine } from "../Core/Engine";

export interface SecurityAuditResult {
    secure: boolean;
    missingArtifacts: string[];
    forbiddenArtifacts: string[];
}

/** Repository-native production security evidence boundary. */
export class SecurityAuditEngine implements Engine {
    name = "SecurityAuditEngine";

    initialize(): void {}

    health(): boolean {
        return true;
    }

    audit(root = process.cwd()): SecurityAuditResult {
        const required = [
            ".gitignore",
            "AGENTS.md",
            "Docs/AI_RULES.md",
            "Assistant/SYSTEM_PROMPT.md",
            "Backend/HBOS/Engines/SecurityLayerEngine.ts"
        ];
        const missingArtifacts = required.filter(path => !existsSync(join(root, path)));
        const forbidden = [
            ".env",
            ".env.local",
            ".env.production",
            "id_rsa",
            "id_ed25519"
        ];
        const forbiddenArtifacts = forbidden.filter(path => existsSync(join(root, path)));
        const autonomousPath = join(root, "Backend", "AI_Runtime", "autonomous_builder.py");
        const autonomousDirectory = join(root, "Backend", "AI_Runtime");
        if (existsSync(autonomousPath) && existsSync(autonomousDirectory)) {
            const files = readdirSync(autonomousDirectory, { withFileTypes: true })
                .filter(entry => entry.isFile())
                .map(entry => entry.name.toLowerCase());
            for (const artifact of ["copilot", "codex", "claude"]) {
                if (files.some(file => file.includes(artifact))) forbiddenArtifacts.push(`cloud-provider:${artifact}`);
            }
        }
        return {
            secure: missingArtifacts.length === 0 && forbiddenArtifacts.length === 0,
            missingArtifacts,
            forbiddenArtifacts
        };
    }
}
