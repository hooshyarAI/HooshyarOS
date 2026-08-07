class BaseAgent:

    def __init__(self,name,role):
        self.name=name
        self.role=role

    def info(self):
        return {
            "name":self.name,
            "role":self.role
        }

