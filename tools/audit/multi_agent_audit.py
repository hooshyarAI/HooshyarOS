#!/usr/bin/env python3
"""Deterministic audit evidence collector and multi-agent fusion gate."""
from __future__ import annotations
import argparse, json, subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any

EXCLUDED={'.git','node_modules','.venv','venv','dist','build','coverage'}
TEXT_EXTENSIONS={'.ts','.tsx','.js','.jsx','.py','.md','.json','.yaml','.yml'}
EXTERNAL_AUDITORS=('cursor','claude-code')
ALLOWED_AUDITORS=set(EXTERNAL_AUDITORS)
REQUIRED_FIELDS={'auditor','timestamp','scope','commit','findings'}
SEVERITIES={'LOW','MEDIUM','HIGH','CRITICAL'}


def git(root:Path,*args:str)->str:
    try:return subprocess.check_output(['git',*args],cwd=root,text=True,stderr=subprocess.STDOUT).strip()
    except (OSError,subprocess.CalledProcessError):return ''


def read(path:Path)->str:
    try:return path.read_text(encoding='utf-8',errors='replace')
    except OSError:return ''


def repository_evidence(root:Path)->dict[str,Any]:
    paths=[]
    for p in root.rglob('*'):
        if p.is_file() and not any(x in EXCLUDED for x in p.parts) and p.suffix.lower() in TEXT_EXTENSIONS:
            paths.append(p.relative_to(root).as_posix())
    roadmap=root/'Docs/Product/PRODUCT_CONSTRUCTION_ROADMAP.json'
    data={}
    if roadmap.exists():
        try:data=json.loads(read(roadmap))
        except json.JSONDecodeError:data={'_parse_error':True}
    ids=[x.get('capabilityId') for x in data.get('capabilities',[]) if isinstance(x,dict) and isinstance(x.get('capabilityId'),str)]
    dup=sorted(k for k,v in _dupes(ids).items() if len(v)>1)
    return {'commit':git(root,'rev-parse','HEAD'),'branch':git(root,'branch','--show-current'),'status':git(root,'status','--porcelain=v1','--untracked-files=all'),'fileCount':len(paths),'documentationCount':sum(p.lower().startswith('docs/') for p in paths),'capabilityIds':sorted(ids),'duplicateCapabilityIds':dup,'masterCharterPresent':(root/'Docs/HOOSHYAROS_MASTER_CHARTER.md').exists(),'architecturePresent':(root/'Docs/ARCHITECTURE.md').exists(),'governanceCharterPresent':(root/'Docs/HOOSHYAROS_GOVERNANCE_CHARTER.md').exists()}


def _dupes(values:list[str])->dict[str,list[str]]:
    out=defaultdict(list)
    for v in values:out[v].append(v)
    return out


def deterministic(e:dict[str,Any])->list[dict[str,Any]]:
    f=[]
    for key,msg in [('masterCharterPresent','Master charter must exist'),('architecturePresent','Architecture contract must exist'),('governanceCharterPresent','Governance charter must exist')]:
        if not e[key]:f.append({'id':key.upper()+'_MISSING','severity':'HIGH','claim':msg})
    if e['duplicateCapabilityIds']:f.append({'id':'CAPABILITY_DUPLICATE','severity':'HIGH','claim':'Capability identifiers must be unique','evidence':e['duplicateCapabilityIds']})
    return f


def load_reports(root:Path)->tuple[list[dict[str,Any]],list[dict[str,Any]]]:
    reports=[]; defects=[]; directory=root/'.audit/evidence'
    for auditor in EXTERNAL_AUDITORS:
        path=directory/f'{auditor}.json'
        if not path.exists():
            defects.append({'id':'EXTERNAL_EVIDENCE_MISSING','severity':'HIGH','auditor':auditor,'path':str(path.relative_to(root))});continue
        try:r=json.loads(read(path))
        except json.JSONDecodeError:
            defects.append({'id':'EXTERNAL_EVIDENCE_INVALID_JSON','severity':'HIGH','auditor':auditor});continue
        if not isinstance(r,dict) or not REQUIRED_FIELDS.issubset(r):
            defects.append({'id':'EXTERNAL_EVIDENCE_SCHEMA_INVALID','severity':'HIGH','auditor':auditor});continue
        if r.get('auditor')!=auditor or r.get('auditor') not in ALLOWED_AUDITORS:
            defects.append({'id':'EXTERNAL_AUDITOR_UNAUTHORIZED','severity':'CRITICAL','auditor':r.get('auditor')});continue
        if not isinstance(r.get('findings'),list):
            defects.append({'id':'EXTERNAL_FINDINGS_INVALID','severity':'HIGH','auditor':auditor});continue
        if not isinstance(r.get('commit'),str) or not r['commit']:
            defects.append({'id':'EXTERNAL_COMMIT_MISSING','severity':'HIGH','auditor':auditor});continue
        reports.append(r)
    return reports,defects


def fuse(reports:list[dict[str,Any]])->list[dict[str,Any]]:
    groups={}
    for r in reports:
        for f in r['findings']:
            if not isinstance(f,dict):continue
            key=str(f.get('fingerprint') or f.get('id') or f.get('claim') or 'unknown')
            g=groups.setdefault(key,{'fingerprint':key,'auditors':[],'findings':[]})
            if r['auditor'] not in g['auditors']:g['auditors'].append(r['auditor'])
            g['findings'].append(f)
    for g in groups.values():
        g['auditors']=sorted(g['auditors']);g['independentSupport']=len(g['auditors']);g['consensus']=g['independentSupport']>=2;g['conflict']=len({json.dumps(x,sort_keys=True) for x in g['findings']})>1
    return sorted(groups.values(),key=lambda x:x['fingerprint'])


def build_audit(root:Path)->dict[str,Any]:
    repo=repository_evidence(root);reports,defects=load_reports(root);det=deterministic(repo);fused=fuse(reports)
    all_findings=det+defects
    conflicts=[x for x in fused if x['conflict']]
    status='REVIEW_REQUIRED' if all_findings or conflicts else 'CLEAN'
    return {'schema':'hooshyar.multi-agent-audit.v2','authority':{'construction':['python','github','assistant'],'audit':['python','cursor','claude-code','zapier'],'externalAuditorsAreNonAuthoritative':True},'repository':repo,'deterministicFindings':det,'evidenceDefects':defects,'externalReports':reports,'fusedFindings':fused,'conflicts':conflicts,'externalEvidenceComplete':not defects,'status':status}


def main()->int:
    p=argparse.ArgumentParser();p.add_argument('--repo',default='.');p.add_argument('--out',default='.audit/multi-agent-audit.json');a=p.parse_args();root=Path(a.repo).resolve();result=build_audit(root);out=root/a.out;out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8');print(json.dumps({'status':result['status'],'commit':result['repository']['commit'],'fusedFindings':len(result['fusedFindings']),'evidenceDefects':len(result['evidenceDefects'])},ensure_ascii=False));return 0 if result['status'] in {'CLEAN','REVIEW_REQUIRED'} else 1

if __name__=='__main__':raise SystemExit(main())
