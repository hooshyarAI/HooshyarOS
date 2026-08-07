class AgentScheduler:


    def __init__(self):

        self.tasks=[]



    def add(self,task):

        self.tasks.append(task)



    def next(self):

        if self.tasks:

            return self.tasks.pop(0)

        return None

