class CrossEngineSignalMapper:

    def map(self, states):
        return {
            "states": states,
            "status": "cross_engine_signals_mapped"
        }
