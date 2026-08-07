class EventBus:


    def __init__(self):

        self.events=[]



    def publish(self,event):

        self.events.append(event)



    def consume(self):

        return self.events

