import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export interface CommercialProductCompletionAuditResult {
    status: "PASS" | "BLOCKED";
    missingLayers: string[];
    blockedExternalDependencies: string[];
    contract: string;
}

export function auditCommercialProductCompletion(root: string, contract = ""): CommercialProductCompletionAuditResult {
    const missingLayers: string[] = [];

    const packagePath = join(root, "package.json");
    if (!existsSync(packagePath)) {
        missingLayers.push("package-json");
    } else {
        const packageJson = JSON.parse(readFileSync(packagePath, "utf8")) as { scripts?: Record<string, string> };
        const scripts = packageJson.scripts ?? {};
        const hasRunnableWebScript = Boolean(scripts.start || scripts.dev || scripts.serve || scripts.preview);
        const webArtifacts = [
            "web/index.html",
            "web/app.js",
            "web/styles.css",
            "web/manifest.webmanifest",
            "Backend/AI_Runtime/CommercialRuntimeServer.ts",
        ];
        const hasWebRuntime = webArtifacts.every(artifact => existsSync(join(root, artifact)));
        if (!hasRunnableWebScript && !hasWebRuntime) missingLayers.push("web-entrypoint");
    }

    const persistenceCandidates = ["Backend/HBOS/Infrastructure", "Backend/HBOS/Persistence", "Backend/AI_Runtime/persistence", "prisma", "database"];
    if (!persistenceCandidates.some(dir => existsSync(join(root, dir)))) missingLayers.push("persistence-boundary");

    const authCandidates = ["Backend/HBOS/Auth", "Backend/HBOS/Security", "Backend/HBOS/Identity"];
    if (!authCandidates.some(dir => existsSync(join(root, dir)))) missingLayers.push("authentication-authorization-boundary");

    const blockedExternalDependencies: string[] = [];
    if (contract.includes("Payment-provider activation is an external dependency")) blockedExternalDependencies.push("payment-provider-activation");

    return {
        status: missingLayers.length || blockedExternalDependencies.length ? "BLOCKED" : "PASS",
        missingLayers,
        blockedExternalDependencies,
        contract,
    };
}
