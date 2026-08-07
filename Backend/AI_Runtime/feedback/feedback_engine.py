class FeedbackEngine:

    def __init__(self):
        self.feedback=[]


    def add(self,message):
        self.feedback.append(message)


    def list(self):
        return self.feedback
