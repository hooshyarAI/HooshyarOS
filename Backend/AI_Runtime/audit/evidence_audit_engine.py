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

CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"}
DOC_EXTENSIONS = {".md", ".txt"}
SKIP_DIRECTORIES = {".git", "node_modules", "dist", "build", "coverage", ".next", ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".idea", ".vscode"}
LAYER_NAMES = {"Core", "Autonomous", "Product", "Commercial", "Security", "Financial", "Engines", "Builder", "Runtime", "Architecture", "Communication", "Persistence", "Factory", "Services"}
SECURITY_PATTERNS = {
    "SEC-PATH-001": ("HIGH", re.compile(r"\breadFile(?:Sync)?\s*\(")),
    "SEC-SUBPROC-001": ("HIGH", re.compile(r"\b(?:spawn|exec|execFile|spawnSync)\s*\(")),
    "SEC-EVAL-001": ("CRITICAL", re.compile(r"\beval\s*\(")),
}

class EvidenceArchitectureAudit:
    """Read-only, evidence-first architecture audit with contextual findings."""
    def __init__(self, repository: str | Path):
        self.root = Path(repository).resolve()
        if not self.root.exists():
            raise FileNotFoundError(self.root)

    def audit(self) -> dict:
        files = self._inventory()
        graph = self._dependency_graph()
        cycles = self._cycles(graph)
        raw_findings = self._raw_findings(graph, files)
        findings = self._aggregate_findings(raw_findings)
        return {
            "audit_version": "2.0",
            "audit_mode": "READ_ONLY_EVIDENCE",
            "baseline": {"head": self._git("rev-parse", "HEAD"), "branch": self._git("branch", "--show-current") or "detached", "clean": not bool(self._git("status", "--porcelain"))},
            "inventory": {"code_files": len(files), "lines": sum(x["lines"] for x in files), "classes": sum(x["classes"] for x in files), "functions": sum(x["functions"] for x in files), "test_like_files": sum(x["test_like"] for x in files)},
            "dependency_graph": {"nodes": graph.number_of_nodes(), "edges": graph.number_of_edges(), "cycles": cycles, "afferent_coupling": self._afferent(graph), "efferent_coupling": self._efferent(graph), "instability": self._instability(graph)},
            "findings_raw": raw_findings,
            "findings": findings,
            "capabilities": self._capability_evidence(files),
            "communication": self._communication_evidence(files),
            "performance_static": self._performance_evidence(files),
            "hotspots": self._hotspots(files, graph),
            "unknowns": ["Runtime latency/throughput/CPU/RAM require local executable measurement.", "Behavioral test effectiveness requires executing tests and collecting effect traces.", "Production readiness cannot be inferred from documentation alone.", "Static security signals require contextual validation before vulnerability classification."]
        }

    def write_evidence(self, output: str | Path) -> dict:
        out = Path(output).resolve(); out.mkdir(parents=True, exist_ok=True)
        result = self.audit()
        (out / "audit.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        (out / "audit_report.md").write_text(self._markdown(result), encoding="utf-8")
        return result

    def _git(self, *args: str) -> str:
        p = subprocess.run(["git", *args], cwd=self.root, capture_output=True, text=True, encoding="utf-8", errors="replace")
        return p.stdout.strip() if p.returncode == 0 else ""

    def _iter_files(self):
        for base, dirs, names in os.walk(self.root):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRECTORIES]
            for name in names:
                p = Path(base) / name
                if p.suffix.lower() in CODE_EXTENSIONS | DOC_EXTENSIONS:
                    yield p

    def _read(self, path: Path) -> str:
        return path.read_text(encoding="utf-8", errors="replace")

    def _rel(self, path: Path) -> str:
        return path.relative_to(self.root).as_posix()

    def _layer(self, path: str) -> str:
        for part in Path(path).parts:
            if part in LAYER_NAMES:
                return part
        return "Other"

    def _metrics(self, path: Path, text: str):
        if path.suffix.lower() == ".py":
            try:
                tree = ast.parse(text)
            except SyntaxError:
                return 0, 0, 0, 0, 0
            return (
                sum(isinstance(n, (ast.Import, ast.ImportFrom)) for n in ast.walk(tree)), 0,
                sum(isinstance(n, ast.ClassDef) for n in ast.walk(tree)),
                sum(isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) for n in ast.walk(tree)),
                1 + sum(isinstance(n, (ast.If, ast.For, ast.While, ast.Try, ast.ExceptHandler, ast.With, ast.Match, ast.BoolOp, ast.IfExp)) for n in ast.walk(tree))
            )
        return (
            len(re.findall(r'import\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?[\'\"]([^\'\"]+)[\'\"]', text)),
            len(re.findall(r'^\s*export\b', text, re.M)),
            len(re.findall(r'\bclass\s+\w+', text)),
            len(re.findall(r'\b(?:async\s+)?function\s+\w+\s*\(|\b(?:public|private|protected|static|async)?\s*\w+\s*\([^)]*\)\s*\{', text)),
            1 + len(re.findall(r'\bif\b|\bfor\b|\bwhile\b|\bcase\b|\bcatch\b|&&|\|\||\?', text))
        )

    def _inventory(self):
        output = []; test_re = re.compile(r'(^|/)(test|tests|__tests__)(/|$)|(\.test\.|\.spec\.)', re.I)
        for path in self._iter_files():
            if path.suffix.lower() not in CODE_EXTENSIONS: continue
            text = self._read(path); imports, exports, classes, functions, complexity = self._metrics(path, text); rel = self._rel(path)
            output.append({"path": rel, "layer": self._layer(rel), "lines": len(text.splitlines()), "imports": imports, "exports": exports, "classes": classes, "functions": functions, "complexity": complexity, "test_like": bool(test_re.search("/" + rel))})
        return output

    def _resolve(self, source: Path, spec: str):
        if not spec.startswith("."): return None
        base = (source.parent / spec).resolve()
        candidates = [base] + [Path(str(base) + e) for e in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py")] + [base / "index.ts", base / "index.js", base / "index.py"]
        for c in candidates:
            if c.exists() and c.is_file():
                try: return self._rel(c)
                except ValueError: return None
        return None

    def _dependency_graph(self):
        if nx is None: raise RuntimeError("networkx is required")
        g = nx.DiGraph(); files = [p for p in self._iter_files() if p.suffix.lower() in CODE_EXTENSIONS]
        ir = re.compile(r'import\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s+)?[\'\"]([^\'\"]+)[\'\"]'); rr = re.compile(r'require\s*\(\s*[\'\"]([^\'\"]+)[\'\"]\s*\)')
        for p in files: g.add_node(self._rel(p))
        for p in files:
            source = self._rel(p); text = self._read(p); specs = ir.findall(text) + rr.findall(text)
            if p.suffix.lower() == ".py": specs += re.findall(r'^\s*from\s+([A-Za-z_][\w.]*)\s+import\s+', text, re.M)
            for spec in specs:
                target = self._resolve(p, spec)
                if target and target != source: g.add_edge(source, target)
        return g

    def _cycles(self, graph): return [sorted(c) for c in nx.strongly_connected_components(graph) if len(c) > 1]
    def _afferent(self, graph): return {n: graph.in_degree(n) for n in graph.nodes() if graph.in_degree(n)}
    def _efferent(self, graph): return {n: graph.out_degree(n) for n in graph.nodes() if graph.out_degree(n)}
    def _instability(self, graph): return {n: round(graph.out_degree(n) / (graph.in_degree(n) + graph.out_degree(n)), 4) if graph.degree(n) else 0.0 for n in graph.nodes()}

    def _raw_findings(self, graph, files):
        findings = []
        regs = [self._rel(p) for p in self._iter_files() if p.name == "EngineRegistry.ts"]
        if len(regs) > 1:
            findings.append({"id":"ARCH-REG-001","severity":"HIGH","confidence":1.0,"class":"ARCHITECTURE","title":"Duplicate EngineRegistry implementations","evidence":regs})
        for source, target in graph.edges():
            a, b = self._layer(source), self._layer(target)
            if a == "Core" and b in {"Product", "Commercial", "Autonomous", "Builder"}:
                findings.append({"id":"ARCH-BOUND-001","severity":"CRITICAL","confidence":0.85,"class":"ARCHITECTURE","title":"Core depends on upper architecture layer","source":source,"target":target})
            if a == "Product" and b == "Autonomous":
                findings.append({"id":"ARCH-BOUND-002","severity":"HIGH","confidence":0.85,"class":"ARCHITECTURE","title":"Product directly depends on Autonomous","source":source,"target":target})
        findings.extend(self._security_signals()); return findings

    def _security_signals(self):
        out=[]
        for path in self._iter_files():
            if path.suffix.lower() not in CODE_EXTENSIONS: continue
            text=self._read(path); rel=self._rel(path); is_test=bool(re.search(r'(^|/)(test|tests|__tests__)(/|$)|(\.test\.|\.spec\.)', rel, re.I))
            for fid,(severity,pattern) in SECURITY_PATTERNS.items():
                if pattern.search(text):
                    out.append({"id":fid,"severity":severity,"confidence":0.25 if is_test else 0.45,"class":"SECURITY_SIGNAL","context":"TEST_SUPPORT" if is_test else "RUNTIME_SIGNAL","title":"Static security signal requires contextual review","source":rel})
        return out

    def _aggregate_findings(self, findings):
        grouped={}
        for f in findings:
            key=(f["id"],f.get("class","UNKNOWN"),f["title"])
            row=grouped.setdefault(key,{"id":f["id"],"class":f.get("class","UNKNOWN"),"title":f["title"],"severity":f["severity"],"confidence":0.0,"evidence_count":0,"sources":[],"disposition":"REVIEW"})
            row["confidence"]=max(row["confidence"],f.get("confidence",0.0)); row["evidence_count"]+=1
            if f.get("source"): row["sources"].append(f["source"])
            if f.get("target"): row["sources"].append(f["target"])
        result=list(grouped.values())
        for row in result:
            row["sources"]=sorted(set(row["sources"]))
            if row["class"]=="SECURITY_SIGNAL": row["disposition"]="SIGNAL_REQUIRES_CONTEXT"; row["severity"]="SIGNAL"
            elif row["id"]=="ARCH-REG-001": row["disposition"]="CONFIRMED_ARCHITECTURE_FINDING"
            elif row["id"].startswith("ARCH-BOUND"): row["disposition"]="ARCHITECTURE_FINDING_REQUIRES_LAYER_SEMANTICS"
        return sorted(result,key=lambda x:(x["severity"]=="SIGNAL", -x["confidence"], x["id"]))

    def _capability_evidence(self, files):
        docs=Counter(); pattern=re.compile(r'\b(?:product|autonomous|commercial|security|runtime|audit)\.[A-Za-z0-9][A-Za-z0-9_.-]+')
        for p in self._iter_files():
            if p.suffix.lower() in DOC_EXTENSIONS:
                for cap in set(pattern.findall(self._read(p))): docs[cap]+=1
        impl={f["path"] for f in files}; tests={f["path"] for f in files if f["test_like"]}; rows=[]
        for cap in sorted(docs):
            token=cap.rsplit(".",1)[-1].lower(); ip=sorted(p for p in impl if token in Path(p).stem.lower()); tp=sorted(p for p in tests if token in Path(p).stem.lower())
            rows.append({"capability":cap,"documentation_count":docs[cap],"implementation_candidates":ip,"test_candidates":tp,"implementation_status":"FOUND" if ip else "UNKNOWN","test_status":"FOUND" if tp else "UNKNOWN"})
        return rows

    def _communication_evidence(self, files):
        pats={"http":r'\b(?:http|https|fetch|axios|request|createServer|listen)\b',"process":r'\b(?:spawn|exec|execFile|fork)\b',"filesystem":r'\b(?:readFile|writeFile|mkdir|readdir|unlink)\b',"sqlite":r'\bsqlite\b|SQLitePersistenceStore',"queue":r'\b(?:queue|publish|consume|subscribe)\b'}; out=[]
        for f in files:
            text=self._read(self.root/f["path"]); channels=[k for k,p in pats.items() if re.search(p,text,re.I)]
            if channels: out.append({"path":f["path"],"channels":channels})
        return out

    def _performance_evidence(self, files):
        out=[]
        for f in files:
            text=self._read(self.root/f["path"]); flags=[]
            if re.search(r'\b(?:spawn|exec|execFile|spawnSync|execFileSync)\b',text): flags.append("subprocess")
            if re.search(r'\breadFileSync|\bwriteFileSync',text): flags.append("sync-filesystem")
            if re.search(r'\bJSON\.(?:parse|stringify)\b',text): flags.append("json-serialization")
            if flags: out.append({"path":f["path"],"flags":flags})
        return out

    def _hotspots(self, files, g):
        p=subprocess.run(["git","log","--name-only","--format=%H","-n","500","--"],cwd=self.root,capture_output=True,text=True,encoding="utf-8",errors="replace"); churn=Counter()
        if p.returncode==0:
            for line in p.stdout.splitlines():
                line=line.strip()
                if line and not re.fullmatch(r"[0-9a-f]{40}",line): churn[line]+=1
        incoming=Counter(t for _,t in g.edges()); rows=[]
        for f in files: rows.append({"path":f["path"],"risk_score":max(1,f["complexity"])*max(1,incoming[f["path"]]+1)*max(1,churn[f["path"]]+1),"complexity":f["complexity"],"dependents":incoming[f["path"]],"churn":churn[f["path"]]})
        return sorted(rows,key=lambda x:x["risk_score"],reverse=True)[:100]

    def _markdown(self,r):
        lines=["# HooshyarOS Evidence-Based Architecture Audit V2","",f"- HEAD: `{r['baseline']['head']}`",f"- Clean: `{r['baseline']['clean']}`",f"- Code files: **{r['inventory']['code_files']}**",f"- Lines: **{r['inventory']['lines']:,}**",f"- Test-like files: **{r['inventory']['test_like_files']}**",f"- Graph nodes: **{r['dependency_graph']['nodes']}**",f"- Graph edges: **{r['dependency_graph']['edges']}**",f"- Cycles/SCC: **{len(r['dependency_graph']['cycles'])}**",f"- Raw findings: **{len(r['findings_raw'])}**",f"- Root findings: **{len(r['findings'])}**","","## Root Findings",""]
        lines += [f"- **{x['severity']}** `{x['id']}` — {x['title']} (confidence={x['confidence']:.2f}, evidence={x['evidence_count']}, disposition={x['disposition']})" for x in r["findings"]] or ["- None"]
        lines += ["","## Unknowns",""]+[f"- {x}" for x in r["unknowns"]]
        return "\n".join(lines)+"\n"

if __name__ == "__main__":
    import argparse
    parser=argparse.ArgumentParser(description="HooshyarOS evidence-based architecture audit")
    parser.add_argument("repository",nargs="?",default=os.environ.get("HOOSHYAR_AUDIT_REPO",".")); parser.add_argument("--out",default=os.environ.get("HOOSHYAR_AUDIT_OUT","AuditOutput")); args=parser.parse_args()
    result=EvidenceArchitectureAudit(args.repository).write_evidence(args.out)
    print(json.dumps({"status":"PASS","audit_version":result["audit_version"],"head":result["baseline"]["head"],"files":result["inventory"]["code_files"],"cycles":len(result["dependency_graph"]["cycles"]),"raw_findings":len(result["findings_raw"]),"root_findings":len(result["findings"]),"output":str(Path(args.out).resolve())},ensure_ascii=False,indent=2))
