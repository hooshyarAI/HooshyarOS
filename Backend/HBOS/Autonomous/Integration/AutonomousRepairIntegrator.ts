import { AutonomousRepairEngine } from "../RepairEngine/AutonomousRepairEngine";

export class AutonomousRepairIntegrator {

private readonly repair =
new AutonomousRepairEngine();

repairFailure(issue:string, output:string){

const plan =
this.repair.createPlan(issue,output);

return this.repair.execute(plan);

}

}
