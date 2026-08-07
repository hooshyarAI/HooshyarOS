class WorkflowEngine:

    def create(self, workflow):
        return {
            "workflow": workflow,
            "status": "workflow_created"
        }
