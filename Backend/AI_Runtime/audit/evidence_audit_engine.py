from __future__ import annotations

import ast
import json
import os
import re
import subprocess
from collections import Counter
from pathlib import Path

try:
    import networkx as nx
except ImportError:
    nx = None

CODE_EXTENSIONS={".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"}
DOC_EXTENSIONS={".md", ".txt"}
SKIP_DIRECTORIES={".git", "node_modules", "dist", "build", "coverage", ".next", ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".idea", ".vscode"}

class EvidenceArchitectureAudit:
    def __init__(self, repository: str | Path):
        self.root=Path(repository).resolve()
        if not self.root.exists():
            raise FileNotFoundError(self.root)

    def audit(self)->dict:
        files=self._inventory()
        graph=self._dependency_graph()
        cycles=[sorted(c) for c in nx.strongly_connected_components(graph) if len(c)>1]
        findings=self._registry_findings()+self._boundary_findings(graph)+self._security_findings()
        return {
            "audit_mode":"READ_ONLY_EVIDENCE",
            "baseline":{
                "head":self._git("rev-parse","HEAD"),
                "branch":self._git("branch","--show-current") or "detached",
                "clean":not bool(self._git("status","--porcelain"))},
            "inventory":{
                "code_files":len(files),
                "lines":sum(x["lines"] for x in files),
                "classes":sum(x["classes"] for x in files),
                "functions":sum(x["functions"] for x in files),
                "test_like_files":sum(x["test_like"] for x in files)},
            "dependency_graph":{
                "nodes":graph.number_of_nodes(),
                "edges":graph.number_of_edges(),
                "cycles":cycles},
            "findings":findings,
            "capabilities":self._capability_evidence(files),
            "communication":self._communication_evidence(files),
            "performance_static":self._performance_evidence(files),
            "hotspots":self._hotspots(files,graph),
            "unknowns":[
                "Runtime latency/throughput/CPU/RAM require local executable measurement.",
                "Behavioral test effectiveness requires executing tests and coverage.",
                "Production readiness cannot be inferred from documentation alone."]}

    def write_evidence(self,output:str|Path)->dict:
        out=Path(output).resolve(); out.mkdir(parents=True,exist_ok=True)
        result=self.audit()
        (out/"audit.json").write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
        (out/"audit_report.md").write_text(self._markdown(result),encoding="utf-8")
        return result

    def _git(self,*args:str)->str:
        p=subprocess.run(["git",*args],cwd=self.root,capture_output=True,text=True,encoding="utf-8",errors="replace")
        return p.stdout.strip() if p.returncode==0 else ""

    def _iter_files(self):
        for base,dirs,names in os.walk(self.root):
            dirs[:]=[d for d in dirs if d not in SKIP_DIRECTORIES]
            for name in names:
                p=Path(base)/name
                if p.suffix.lower() in CODE_EXTENSIONS|DOC_EXTENSIONS:
                    yield p

    def _read(self,p): return p.read_text(encoding="utf-8",errors="replace")
    def _rel(self,p): return p.relative_to(self.root).as_posix()

    def _layer(self,path):
        parts=set(Path(path).parts)
        for layer in ("Core","Autonomous","Product","Commercial","Security","Financial","Engines","Builder","Runtime","Architecture","Communication","Persistence","Factory","Services"):
            if layer in parts: return layer
        return "Other"

    def _metrics(self,p,text):
        if p.suffix.lower()==".py":
            try: tree=ast.parse(text)
            except SyntaxError: return 0,0,0,0,0
            return (
                sum(isinstance(n,(ast.Import,ast.ImportFrom)) for n in ast.walk(tree)),
                0,
                sum(isinstance(n,ast.ClassDef) for n in ast.walk(tree)),
                sum(isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) for n in ast.walk(tree)),
                1+sum(isinstance(n,(ast.If,ast.For,ast.While,ast.Try,ast.ExceptHandler,ast.With,ast.Match,ast.BoolOp,ast.IfExp)) for n in ast.walk(tree)))
        return (
            len(re.findall(r'import\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?[\'\"]([^\'\"]+)[\'\"]',text)),
            len(re.findall(r'^\s*export\b',text,re.M)),
            len(re.findall(r'\bclass\s+\w+',text)),
            len(re.findall(r'\b(?:async\s+)?function\s+\w+\s*\(|\b(?:public|private|protected|static|async)?\s*\w+\s*\([^)]*\)\s*\{',text)),
            1+len(re.findall(r'\bif\b|\bfor\b|\bwhile\b|\bcase\b|\bcatch\b|&&|\|\||\?',text)))

    def _inventory(self):
        out=[]
        test_re=re.compile(r'(^|/)(test|tests|__tests__)(/|$)|(\.test\.|\.spec\.)',re.I)
        for p in self._iter_files():
            if p.suffix.lower() not in CODE_EXTENSIONS: continue
            text=self._read(p); i,e,c,f,x=self._metrics(p,text); path=self._rel(p)
            out.append({"path":path,"layer":self._layer(path),"lines":len(text.splitlines()),"imports":i,"exports":e,"classes":c,"functions":f,"complexity":x,"test_like":bool(test_re.search("/"+path))})
        return out

    def _resolve(self,source,spec):
        if not spec.startswith("."): return None
        base=(source.parent/spec).resolve()
        candidates=[base]+[Path(str(base)+e) for e in (".ts",".tsx",".js",".jsx",".mjs",".cjs",".py")]+[base/"index.ts",base/"index.js",base/"index.py"]
        for c in candidates:
            if c.exists() and c.is_file():
                try: return self._rel(c)
                except ValueError: return None
        return None

    def _dependency_graph(self):
        if nx is None: raise RuntimeError("networkx is required")
        g=nx.DiGraph()
        files=[p for p in self._iter_files() if p.suffix.lower() in CODE_EXTENSIONS]
        ir=re.compile(r'import\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?[\'\"]([^\'\"]+)[\'\"]')
        rr=re.compile(r'require\s*\(\s*[\'\"]([^\'\"]+)[\'\"]\s*\)')
        for p in files: g.add_node(self._rel(p))
        for p in files:
            source=self._rel(p); text=self._read(p); specs=ir.findall(text)+rr.findall(text)
            if p.suffix.lower()==".py": specs+=re.findall(r'^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+',text,re.M)
            for spec in specs:
                target=self._resolve(p,spec)
                if target and target!=source: g.add_edge(source,target)
        return g

    def _registry_findings(self):
        regs=[self._rel(p) for p in self._iter_files() if p.name=="EngineRegistry.ts"]
        return [{"id":"ARCH-REG-001","severity":"HIGH","title":"Duplicate EngineRegistry implementations","evidence":regs}] if len(regs)>1 else []

    def _boundary_findings(self,g):
        out=[]
        for s,t in g.edges():
            a,b=self._layer(s),self._layer(t)
            if a=="Core" and b in {"Product","Commercial","Autonomous"}:
                out.append({"id":"ARCH-BOUND-001","severity":"CRITICAL","title":"Core depends on upper architecture layer","source":s,"target":t})
            if a=="Product" and b=="Autonomous":
                out.append({"id":"ARCH-BOUND-002","severity":"HIGH","title":"Product directly depends on Autonomous","source":s,"target":t})
        return out

    def _security_findings(self):
        rules=[("SEC-PATH-001","HIGH",r'\breadFile(?:Sync)?\s*\('),("SEC-SUBPROC-001","HIGH",r'\b(?:spawn|exec|execFile|spawnSync)\s*\('),("SEC-EVAL-001","CRITICAL",r'\beval\s*\(')]
        out=[]
        for p in self._iter_files():
            if p.suffix.lower() not in CODE_EXTENSIONS: continue
            text=self._read(p)
            for fid,sev,pat in rules:
                if re.search(pat,text):
                    out.append({"id":fid,"severity":sev,"title":"Static security boundary requires review","source":self._rel(p)})
        return out

    def _capability_evidence(self,files):
        docs=Counter()
        pattern=re.compile(r'\b(?:product|autonomous|commercial|security|runtime|audit)\.[A-Za-z0-9][A-Za-z0-9_.-]+')
        for p in self._iter_files():
            if p.suffix.lower() in DOC_EXTENSIONS:
                for cap in set(pattern.findall(self._read(p))): docs[cap]+=1
        impl={f["path"] for f in files}; tests={f["path"] for f in files if f["test_like"]}; rows=[]
        for cap in sorted(docs):
            token=cap.rsplit(".",1)[-1].lower()
            ip=sorted(p for p in impl if token in Path(p).stem.lower())
            tp=sorted(p for p in tests if token in Path(p).stem.lower())
            rows.append({"capability":cap,"documentation_files":docs[cap],"implementation_candidates":ip,"test_candidates":tp,"implementation_status":"FOUND" if ip else "UNKNOWN","test_status":"FOUND" if tp else "UNKNOWN"})
        return rows

    def _communication_evidence(self,files):
        pats={"http":r'\b(?:http|https|fetch|axios|request|createServer|listen)\b',"process":r'\b(?:spawn|exec|execFile|fork)\b',"filesystem":r'\b(?:readFile|writeFile|mkdir|readdir|unlink)\b',"sqlite":r'\bsqlite\b|SQLitePersistenceStore',"queue":r'\b(?:queue|publish|consume|subscribe)\b'}
        out=[]
        for f in files:
            text=self._read(self.root/f["path"]); channels=[k for k,p in pats.items() if re.search(p,text,re.I)]
            if channels: out.append({"path":f["path"],"channels":channels})
        return out

    def _performance_evidence(self,files):
        out=[]
        for f in files:
            text=self._read(self.root/f["path"]); flags=[]
            if re.search(r'\b(?:spawn|exec|execFile|spawnSync|execFileSync)\b',text): flags.append("subprocess")
            if re.search(r'\breadFileSync|\bwriteFileSync',text): flags.append("sync-filesystem")
            if re.search(r'\bJSON\.(?:parse|stringify)\b',text): flags.append("json-serialization")
            if flags: out.append({"path":f["path"],"flags":flags})
        return out

    def _hotspots(self,files,g):
        p=subprocess.run(["git","log","--name-only","--format=%H","-n","500","--"],cwd=self.root,capture_output=True,text=True,encoding="utf-8",errors="replace")
        churn=Counter()
        if p.returncode==0:
            for line in p.stdout.splitlines():
                line=line.strip()
                if line and not re.fullmatch(r"[0-9a-f]{40}",line): churn[line]+=1
        incoming=Counter(t for _,t in g.edges()); rows=[]
        for f in files:
            rows.append({"path":f["path"],"risk_score":max(1,f["complexity"])*max(1,incoming[f["path"]]+1)*max(1,churn[f["path"]]+1),"complexity":f["complexity"],"dependents":incoming[f["path"]],"churn":churn[f["path"]]})
        return sorted(rows,key=lambda x:x["risk_score"],reverse=True)[:100]

    def _markdown(self,r):
        lines=["# HooshyarOS Evidence-Based Architecture Audit","",f"- HEAD: `{r['baseline']['head']}`",f"- Clean: `{r['baseline']['clean']}`",f"- Code files: **{r['inventory']['code_files']}**",f"- Lines: **{r['inventory']['lines']:,}**",f"- Test-like files: **{r['inventory']['test_like_files']}**",f"- Graph nodes: **{r['dependency_graph']['nodes']}**",f"- Graph edges: **{r['dependency_graph']['edges']}**",f"- Cycles/SCC: **{len(r['dependency_graph']['cycles'])}**",f"- Findings: **{len(r['findings'])}**","","## Findings",""]
        lines += [f"- **{x['severity']}** `{x['id']}` — {x['title']}" for x in r["findings"]] or ["- None"]
        lines += ["","## Unknowns",""] + [f"- {x}" for x in r["unknowns"]]
        return "\n".join(lines)+"\n"

if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser(); parser.add_argument("repository",nargs="?",default=os.environ.get("HOOSHYAR_AUDIT_REPO",".")); parser.add_argument("--out",default=os.environ.get("HOOSHYAR_AUDIT_OUT","AuditOutput")); args=parser.parse_args()
    result=EvidenceArchitectureAudit(args.repository).write_evidence(args.out)
    print(json.dumps({"status":"PASS","head":result["baseline"]["head"],"files":result["inventory"]["code_files"],"cycles":len(result["dependency_graph"]["cycles"]),"findings":len(result["findings"]),"output":str(Path(args.out).resolve())},ensure_ascii=False,indent=2))
