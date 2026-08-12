# Cloud Deployment Engine

Repository-native cloud deployment execution boundary for HooshyarOS.

The engine does not embed a cloud provider SDK. It executes the governed deployment manifest through the Python deployment worker.

## Evidence

- `Backend/HBOS/Engines/CloudDeploymentEngine.ts`
- `Backend/HBOS/test/CloudDeploymentEngine.test.ts`
- `Backend/AI_Runtime/cloud_deployment.py`
- `Backend/HBOS/Assistant/Autonomous/Production/DeploymentController.ts`

## Runtime contract

A deployment manifest provides a provider label and a command list. The Python worker executes that command in the manifest directory and returns structured JSON evidence.
