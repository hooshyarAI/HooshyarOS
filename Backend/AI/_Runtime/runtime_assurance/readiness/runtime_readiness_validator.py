class RuntimeReadinessValidator:
    def validate(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_readiness_validated",
        }


class RuntimeReadinessValidatorV2:
    def validate(self, runtime):
        return {
            "runtime": runtime,
            "status": "runtime_readiness_revalidated",
        }