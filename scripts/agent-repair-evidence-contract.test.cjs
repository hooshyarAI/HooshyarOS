'use strict';
const {buildRepairEvidence,validateRepairEvidence}=require('./agent-repair-evidence-contract.cjs');
const currentCommit='a'.repeat(40), previousCommit='b'.repeat(40);
const mission={commit:previousCommit,workflow:{runId:1234},failure:{failedJobs:['windows-product-factory'],failedSteps:['factory:failure']}};
const factoryRun={id:5678,head_sha:currentCommit,conclusion:'failure',productFactoryConclusion:'success',html_url:'https://github.com/example/repo/actions/runs/5678'};
function validEvidence(){return buildRepairEvidence({commit:currentCommit,previousCommit,mission,missionId:'f'.repeat(64),changedFiles:2,regressionStatus:'PASS',pythonSyntaxStatus:'PASS',factoryRun});}
describe('autonomous repair evidence contract',()=>{
 test('accepts current-commit repair, regression and factory evidence',()=>expect(validateRepairEvidence(validEvidence(),currentCommit)).toEqual({valid:true,reason:'CURRENT_COMMIT_REPAIR_AND_ACCEPTANCE_VERIFIED'}));
 test('rejects stale commit',()=>expect(validateRepairEvidence(validEvidence(),'c'.repeat(40)).reason).toBe('EVIDENCE_COMMIT_MISMATCH'));
 test('rejects no changed implementation files',()=>{const e=validEvidence();e.repair.changedFiles=0;expect(validateRepairEvidence(e,currentCommit).reason).toBe('REPAIR_HAS_NO_CHANGED_FILES');});
 test('rejects failed regression or syntax',()=>{const e=validEvidence();e.regression.fullJest='FAIL';expect(validateRepairEvidence(e,currentCommit).reason).toBe('REGRESSION_EVIDENCE_NOT_PASS');const s=validEvidence();s.regression.pythonSyntax='FAIL';expect(validateRepairEvidence(s,currentCommit).reason).toBe('REGRESSION_EVIDENCE_NOT_PASS');});
 test('rejects factory result from another commit or failed product factory job',()=>{const e=validEvidence();e.factoryAcceptance.commit=previousCommit;expect(validateRepairEvidence(e,currentCommit).reason).toBe('FACTORY_ACCEPTANCE_NOT_PASS_FOR_COMMIT');const f=validEvidence();f.factoryAcceptance.status='BLOCKED';expect(validateRepairEvidence(f,currentCommit).reason).toBe('FACTORY_ACCEPTANCE_NOT_PASS_FOR_COMMIT');const failedJob=validEvidence();failedJob.factoryAcceptance.productFactoryConclusion='failure';expect(validateRepairEvidence(failedJob,currentCommit).reason).toBe('FACTORY_ACCEPTANCE_NOT_PASS_FOR_COMMIT');});
 test('rejects missing failure provenance',()=>{const e=validEvidence();e.finding.failedJobs=[];expect(validateRepairEvidence(e,currentCommit).reason).toBe('FAILED_JOB_EVIDENCE_MISSING');});
 test('rejects invalid commit chain',()=>{const e=validEvidence();e.repair.previousCommit=currentCommit;expect(validateRepairEvidence(e,currentCommit).reason).toBe('REPAIR_COMMIT_CHAIN_INVALID');});
});
