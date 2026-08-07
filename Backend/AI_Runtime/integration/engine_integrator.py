class EngineIntegrator:

    def __init__(self):
        self.name = "EngineIntegrator"

    def connect(self, engines):

        return {
            "engines": engines,
            "count": len(engines),
            "status": "integrated"
        }
