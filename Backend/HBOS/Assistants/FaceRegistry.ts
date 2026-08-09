import { ExecutiveFace } from "./Faces/ExecutiveFace";
import { FinancialFace } from "./Faces/FinancialFace";
import { AccountingFace } from "./Faces/AccountingFace";
import { TaxFace } from "./Faces/TaxFace";
import { AuditFace } from "./Faces/AuditFace";
import { DecisionFace } from "./Faces/DecisionFace";
import { RiskFace } from "./Faces/RiskFace";
import { StrategyFace } from "./Faces/StrategyFace";
import { OperationsFace } from "./Faces/OperationsFace";
import { KnowledgeFace } from "./Faces/KnowledgeFace";
import { AssistantFace } from "./Faces/AssistantFace";
import { AutonomousFace } from "./Faces/AutonomousFace";


export class FaceRegistry {


faces=[

new ExecutiveFace(),
new FinancialFace(),
new AccountingFace(),
new TaxFace(),
new AuditFace(),
new DecisionFace(),
new RiskFace(),
new StrategyFace(),
new OperationsFace(),
new KnowledgeFace(),
new AssistantFace(),
new AutonomousFace()

];


initialize(){

this.faces.forEach(x=>x.initialize());

}


}

