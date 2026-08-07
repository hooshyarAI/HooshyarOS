class RuntimeAgent:

    def __init__(self,name):

        self.name=name


    def execute(self,task):

        return {
            "agent":self.name,
            "task":task,
            "status":"completed"
        }
