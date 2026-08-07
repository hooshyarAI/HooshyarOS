from Backend.AI_Runtime.autonomy.autonomy_engine import AutonomyEngine


class ExecutionLoop:

    def execute(self, goal):

        engine = AutonomyEngine()

        return engine.run(goal)
