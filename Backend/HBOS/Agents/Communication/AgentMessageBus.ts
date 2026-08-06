export class AgentMessageBus {

private messages:any[] = [];

publish(message:any){

    this.messages.push(message);

}

consume(){

    return this.messages.shift();

}

getMessages(){

    return this.messages;

}

}
