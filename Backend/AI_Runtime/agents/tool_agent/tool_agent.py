class ToolAgent:

    def use(self, tool):
        return {
            "tool": tool,
            "status": "tool_used"
        }

