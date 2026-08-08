class RuntimeHealthAggregator:

    def aggregate(self, health_states):
        return {
            "health_states": health_states,
            "status": "runtime_health_aggregated"
        }
