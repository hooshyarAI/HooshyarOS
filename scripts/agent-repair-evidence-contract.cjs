'use strict';
const TYPE='ASSISTANT_REPAIR_MISSION_V1_RESULT';
function buildRepairEvidence({commit,previousCommit,mission,missionId,changedFiles,regressionStatus,pythonSyntaxStatus,factoryRun}) {
 return {type:TYPE,status:'PASS',commit,createdAt:new Date().toISOString(),missionId,
 finding:{sourceRunId:Number(mission.workflow.runId),sourceCommit:mission.commit,failedJobs:[...mission.failure.failedJobs],failedSteps:[...mission.failure.failedSteps]},
 repair:{previousCommit,commit,changedFiles,changedPaths:[]},
 regression:{status:regressionStatus,fullJest:regressionStatus,pythonSyntax:pythonSyntaxStatus},
 factoryAcceptance:{status:factoryRun.productFactoryConclusion==='success'?'PASS':'BLOCKED',runId:Number(factoryRun.id),commit:factoryRun.head_sha||commit,productFactoryJob:'windows-product-factory',productFactoryConclusion:factoryRun.productFactoryConclusion||'missing',workflowConclusion:factoryRun.conclusion||null,url:factoryRun.html_url||null}};
}
function validateRepairEvidence(e,currentCommit) {
 if(!e||e.type!==TYPE)return {valid:false,reason:'EVIDENCE_TYPE_INVALID'};
 if(e.status!=='PASS')return {valid:false,reason:'EVIDENCE_STATUS_NOT_PASS'};
 if(!/^[0-9a-f]{40}$/i.test(currentCommit||'')||e.commit!==currentCommit)return {valid:false,reason:'EVIDENCE_COMMIT_MISMATCH'};
 if(!e.missionId||!e.finding||!Number.isInteger(e.finding.sourceRunId)||e.finding.sourceRunId<1)return {valid:false,reason:'MISSION_FINDING_MISSING'};
 if(!Array.isArray(e.finding.failedJobs)||!e.finding.failedJobs.length)return {valid:false,reason:'FAILED_JOB_EVIDENCE_MISSING'};
 if(!e.repair||e.repair.commit!==currentCommit||e.repair.previousCommit===currentCommit)return {valid:false,reason:'REPAIR_COMMIT_CHAIN_INVALID'};
 if(!Number.isInteger(e.repair.changedFiles)||e.repair.changedFiles<1)return {valid:false,reason:'REPAIR_HAS_NO_CHANGED_FILES'};
 if(!e.regression||e.regression.status!=='PASS'||e.regression.fullJest!=='PASS'||e.regression.pythonSyntax!=='PASS')return {valid:false,reason:'REGRESSION_EVIDENCE_NOT_PASS'};
 if(!e.factoryAcceptance||e.factoryAcceptance.status!=='PASS'||e.factoryAcceptance.commit!==currentCommit||e.factoryAcceptance.productFactoryJob!=='windows-product-factory'||e.factoryAcceptance.productFactoryConclusion!=='success'||!Number.isInteger(e.factoryAcceptance.runId)||e.factoryAcceptance.runId<1)return {valid:false,reason:'FACTORY_ACCEPTANCE_NOT_PASS_FOR_COMMIT'};
 return {valid:true,reason:'CURRENT_COMMIT_REPAIR_AND_ACCEPTANCE_VERIFIED'};
}
module.exports={TYPE,buildRepairEvidence,validateRepairEvidence};
