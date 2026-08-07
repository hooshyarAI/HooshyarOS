class PlannerAgent:

    def create_plan(self,goal):

        return {
            "goal":goal,
            "tasks":[
                "analyze",
                "build",
                "test"
            ]
        }

