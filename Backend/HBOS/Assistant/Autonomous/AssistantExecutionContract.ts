export interface AssistantExecutionContract {

status:string;

goal:string;

plan:any;

decision:{
 input:any;
 decision:string;
 confidence:number;
};

execution:any;

health:{
 healthy:boolean;
 status:string;
};

}

