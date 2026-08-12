import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

export interface CloudDeploymentRequest {
    manifestPath: string;
    pythonExecutable?: string;
    workerPath?: string;
}

export interface CloudDeploymentResult {
    ok: boolean;
    provider: string;
    returnCode: number;
    output: string;
}

export class CloudDeploymentEngine {
    health(): boolean { return true; }

    deploy(request: CloudDeploymentRequest): CloudDeploymentResult {
        if (!existsSync(request.manifestPath)) {
            return { ok: false, provider: "generic", returnCode: 3, output: `manifest not found: ${request.manifestPath}` };
        }
        const python = request.pythonExecutable ?? "python";
        const worker = request.workerPath ?? "Backend/AI_Runtime/cloud_deployment.py";
        const result = spawnSync(python, [worker, request.manifestPath], {
            encoding: "utf8",
            windowsHide: true,
        });
        const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
        return {
            ok: result.status === 0,
            provider: "generic",
            returnCode: result.status ?? 1,
            output,
        };
    }
}
