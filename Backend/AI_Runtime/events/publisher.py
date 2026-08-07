class EventPublisher:


    def __init__(self):

        self.queue=[]



    def publish(self,event):

        self.queue.append(event)



    def consume(self):

        return self.queue

