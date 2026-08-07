from Backend.AI_Runtime.organization.organization_engine import OrganizationEngine
from Backend.AI_Runtime.operations.operations_engine import OperationsEngine


class RuntimeIntegration:

    def run(self, goal):

        organization = OrganizationEngine().analyze(goal)

        operation = OperationsEngine().execute(goal)

        return {
            "organization": organization,
            "operation": operation,
            "status": "integrated"
        }
