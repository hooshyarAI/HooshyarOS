class EngineStateCollector:

    def collect(self, engines):
        return {
            "engines": engines,
            "status": "engine_states_collected"
        }
