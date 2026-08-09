import { AutonomousFailureAnalyzer } 
from "../Analyzer/AutonomousFailureAnalyzer";

import { AutonomousRepairIntegrator }
from "../Integration/AutonomousRepairIntegrator";


export class SelfHealingOrchestrator{


private analyzer =
new AutonomousFailureAnalyzer();


private repair =
new AutonomousRepairIntegrator();



heal(output:string){


const report =
this.analyzer.analyze(output);


return this.repair.repairFailure(
report.type,
output
);


}


}
