export class AutonomousGoalManager {

private goals:any[]=[];

create(goal:string){

const item={
goal,
created:new Date().toISOString(),
status:"CREATED"
};

this.goals.push(item);

return item;

}


list(){
return this.goals;
}

}
