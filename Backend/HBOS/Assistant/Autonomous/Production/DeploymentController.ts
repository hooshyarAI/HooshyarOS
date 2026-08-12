import { CloudDeploymentEngine, CloudDeploymentRequest, CloudDeploymentResult } from "../../../Engines/CloudDeploymentEngine";

export class DeploymentController {
    constructor(private readonly engine = new CloudDeploymentEngine()) {}

    deploy(request: CloudDeploymentRequest): CloudDeploymentResult {
        return this.engine.deploy(request);
    }
}
