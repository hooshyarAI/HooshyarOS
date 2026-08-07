export interface ArchitectureRule {
    name:string;
    description:string;
    priority:number;
}

export class ArchitectureRegistry {

private rules:ArchitectureRule[]=[];

addRule(rule:ArchitectureRule){
    this.rules.push(rule);
}

getRules(){
    return this.rules;
}

}

