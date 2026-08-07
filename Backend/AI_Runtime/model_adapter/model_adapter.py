class ModelAdapter:

    def call(self, prompt):
        return {
            "prompt": prompt,
            "status": "model_called"
        }

