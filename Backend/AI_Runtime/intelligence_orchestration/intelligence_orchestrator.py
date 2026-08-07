from Backend.AI_Runtime.tool_layer.tool_registry import ToolRegistry
from Backend.AI_Runtime.agent_tools.agent_tool_manager import AgentToolManager
from Backend.AI_Runtime.python_runtime.python_runtime import PythonRuntime
from Backend.AI_Runtime.model_adapter.model_adapter import ModelAdapter
from Backend.AI_Runtime.execution_pipeline.execution_pipeline import ExecutionPipeline
from Backend.AI_Runtime.agent_memory.agent_memory import AgentMemory
from Backend.AI_Runtime.automation.automation_engine import AutomationEngine
from Backend.AI_Runtime.intelligent_services.intelligent_service import IntelligentService
from Backend.AI_Runtime.agent_factory.agent_factory import AgentFactory


class IntelligenceOrchestrator:


    def run(self, input):

        return {

            "tool":
                ToolRegistry().register(input),

            "execution":
                AgentToolManager().execute(input),

            "python":
                PythonRuntime().run(input),

            "model":
                ModelAdapter().call(input),

            "pipeline":
                ExecutionPipeline().process(input),

            "memory":
                AgentMemory().remember(input),

            "automation":
                AutomationEngine().automate(input),

            "service":
                IntelligentService().serve(input),

            "agent":
                AgentFactory().create(input),

            "status":
                "intelligence_ready"
        }

