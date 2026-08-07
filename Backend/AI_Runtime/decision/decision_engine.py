class DecisionEngine:

    def __init__(self):

        self.decisions=[]


    def decide(self,goal):

        decision={
            "goal":goal,
            "action":"execute",
            "status":"created"
        }

        self.decisions.append(decision)

        return decision



    def update(self,feedback):

        if self.decisions:

            self.decisions[-1]["feedback"]=feedback

            self.decisions[-1]["status"]="updated"



    def history(self):

        return self.decisions
