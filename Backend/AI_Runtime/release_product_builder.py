from __future__ import annotations

import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist" / "productization" / "windows"


def _should_skip_file(path: Path) -> bool:
    name = path.name
    return (path.is_dir() and name in {"__pycache__", "node_modules"}) or name.endswith((".pyc", ".test", ".spec")) or name in {".git"}


def _validate_windows_node_executable(node_exe: Path) -> None:
    data = node_exe.read_bytes()[:2]
    if data != b"MZ":
        raise RuntimeError(f"Windows packaging requires a Windows PE node.exe; got non-PE executable: {node_exe}")


def _validate_windows_payload(payload: Path) -> None:
    if not payload.exists():
        raise FileNotFoundError(payload)
    if any(p.suffix == ".pyc" or "__pycache__" in p.parts for p in payload.rglob("*")):
        raise RuntimeError("development artifacts leaked into customer payload")
    required = [
        payload / "node-runtime" / "node.exe",
        payload / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "start-commercial-runtime.ts",
        payload / "Backend" / "AI_Runtime" / "node_modules" / "tsx",
        payload / "web" / "index.html",
        payload / "web" / "app.js",
        payload / "web" / "styles.css",
    ]
    missing = [str(path) for path in required if not path.exists()]
    if missing:
        raise RuntimeError(f"customer payload incomplete: {missing}")
    _validate_windows_node_executable(payload / "node-runtime" / "node.exe")


def _runtime_dependency_names() -> list[str]:
    roots = {"tsx", "typescript"}
    package_root = ROOT / "node_modules"
    pending = list(roots)
    seen: set[str] = set()
    while pending:
        name = pending.pop()
        if name in seen:
            continue
        seen.add(name)
        manifest = package_root / name / "package.json"
        if not manifest.exists():
            continue
        try:
            import json
            package = json.loads(manifest.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for dependency in {**package.get("dependencies", {}), **package.get("optionalDependencies", {})}:
            if dependency not in seen:
                pending.append(dependency)
    return sorted(seen)


def _copy_node_dependency(source: Path, destination: Path) -> None:
    if source.exists():
        shutil.copytree(source, destination, dirs_exist_ok=True)


def _copy_runtime_node_modules(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for name in _runtime_dependency_names():
        _copy_node_dependency(source / name, destination / name)


def _write_launch_surface(payload: Path) -> None:
    (payload / "launch-hooshyar.cmd").write_text(
        "@echo off\r\n"
        "setlocal\r\n"
        "set HOOSHYAR_HOST=127.0.0.1\r\n"
        "set HOOSHYAR_PORT=4173\r\n"
        '"%~dp0node-runtime\\node.exe" "%~dp0Backend\\AI_Runtime\\node_modules\\tsx\\dist\\cli.mjs" "%~dp0Backend\\HBOS\\Autonomous\\Runtime\\start-commercial-runtime.ts"\r\n',
        encoding="utf-8",
    )
    (payload / "launch-hooshyar.vbs").write_text(
        'Dim shell, fso, here\r\n'
        'Set shell = CreateObject("WScript.Shell")\r\n'
        'Set fso = CreateObject("Scripting.FileSystemObject")\r\n'
        'here = fso.GetParentFolderName(WScript.ScriptFullName)\r\n'
        'shell.Run """" & here & "\\launch-hooshyar.cmd"""", 0, False\r\n'
        'WScript.Sleep 1800\r\n'
        'shell.Run "http://127.0.0.1:4173/", 1, False\r\n',
        encoding="utf-8",
    )
    start_menu_path = r"Microsoft\Windows\Start Menu\Programs\HooshyarOS"
    (payload / "HooshyarOS-StartMenu.txt").write_text(start_menu_path + "\n", encoding="utf-8")
    (payload / "install-health.ps1").write_text(
        "$ErrorActionPreference='Stop'\n"
        "$here = Split-Path -Parent $MyInvocation.MyCommand.Path\n"
        "$launcher = Join-Path $here 'launch-hooshyar.cmd'\n"
        "$process = Start-Process -FilePath $launcher -WorkingDirectory $here -PassThru\n"
        "try {\n"
        "  $deadline=(Get-Date).AddSeconds(20)\n"
        "  do {\n"
        "    try { $response=Invoke-RestMethod -Uri 'http://127.0.0.1:4173/health' -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 500 }\n"
        "  } while ((Get-Date) -lt $deadline)\n"
        "  if (-not $response -or $response.status -ne 'ok') { throw 'HooshyarOS runtime health check failed' }\n"
        "  Write-Output 'HooshyarOS installed and health-checked'\n"
        "}\n"
        "finally {\n"
        "  if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }\n"
        "}\n",
        encoding="utf-8",
    )


def _write_web_surface(web: Path) -> None:
    (web / "index.html").write_text(
        "<!doctype html><html lang='fa' dir='rtl'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>هوشیار.ai</title><link rel='stylesheet' href='/styles.css'></head>"
        "<body><div class='shell'><header><h1>هوشیار.ai</h1><p>سامانه هوشمند تحلیل مالی و مدیریتی</p></header>"
        "<section class='card'><h2>ورود سازمان</h2><div class='grid'>"
        "<input id='username' placeholder='نام کاربری' value='qa-user'><input id='organization' placeholder='سازمان' value='Hooshyar QA'>"
        "</div><button id='login'>ورود</button><span id='sessionStatus' class='status'></span></section>"
        "<section class='card'><h2>تحلیل مالی</h2><textarea id='csv' rows='8'>date,account,debit,credit,currency\n2026-08-01,Cash,1000,0,IRR\n2026-08-02,Sales,0,1500,IRR\n2026-08-03,Expense,300,0,IRR\n2026-08-04,Receivable,0,800,IRR</textarea>"
        "<div class='grid'><input id='assets' type='number' value='10000' placeholder='دارایی'><input id='liabilities' type='number' value='4000' placeholder='بدهی'></div>"
        "<button id='analyze'>تحلیل کن</button><span id='analysisStatus' class='status'></span></section>"
        "<section class='card'><h2>داشبورد</h2><div id='dashboard' class='dashboard'>ابتدا وارد شوید و تحلیل را اجرا کنید.</div></section>"
        "<script src='/app.js'></script></div></body></html>",
        encoding="utf-8",
    )
    (web / "styles.css").write_text(
        "body{margin:0;background:#0f172a;color:#e2e8f0;font-family:Segoe UI,Tahoma,sans-serif}.shell{max-width:980px;margin:0 auto;padding:32px}header{text-align:center;margin-bottom:24px}h1{margin:0 0 8px;font-size:42px}.card{background:#111827;border:1px solid #334155;border-radius:16px;padding:20px;margin:16px 0;box-shadow:0 8px 24px rgba(0,0,0,.18)}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}@media(max-width:700px){.grid{grid-template-columns:1fr}}input,textarea{width:100%;box-sizing:border-box;background:#0b1220;color:#e2e8f0;border:1px solid #475569;border-radius:10px;padding:12px;font-size:16px}textarea{resize:vertical}button{background:#2563eb;color:white;border:0;border-radius:10px;padding:12px 20px;font-size:16px;cursor:pointer}.status{display:inline-block;margin-right:12px}.dashboard{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metric{background:#0b1220;padding:18px;border-radius:12px}.metric b{display:block;font-size:28px;margin-top:8px}@media(max-width:700px){.dashboard{grid-template-columns:1fr}}.ok{color:#4ade80}.err{color:#f87171}",
        encoding="utf-8",
    )
    (web / "app.js").write_text(
        "const $=id=>document.getElementById(id);\n"
        "async function api(url,options={}){const r=await fetch(url,{credentials:'same-origin',...options});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||`HTTP ${r.status}`);return body;}\n"
        "function status(id,text,ok=true){const e=$(id);e.textContent=text;e.className='status '+(ok?'ok':'err');}\n"
        "$('login').onclick=async()=>{try{const b=await api('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('username').value,organization:$('organization').value})});status('sessionStatus',`ورود موفق — ${b.organization.name}`);await loadDashboard()}catch(e){status('sessionStatus',e.message,false)}};\n"
        "$('analyze').onclick=async()=>{try{const b=await api('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csv:$('csv').value,sourceName:'desktop-ledger.csv',assets:Number($('assets').value),liabilities:Number($('liabilities').value)})});status('analysisStatus',`تحلیل آماده — سود ${b.metrics.profit}`);await loadDashboard()}catch(e){status('analysisStatus',e.message,false)}};\n"
        "async function loadDashboard(){try{const b=await api('/api/dashboard');if(!b.analysisAvailable){$('dashboard').innerHTML='<div>هنوز تحلیلی ثبت نشده است.</div>';return}$('dashboard').innerHTML=`<div class='metric'>درآمد<b>${b.metrics.revenue}</b></div><div class='metric'>سود<b>${b.metrics.profit}</b></div><div class='metric'>ریسک<b>${b.metrics.risk}%</b></div>`}catch(e){$('dashboard').textContent=e.message}}\n"
        "loadDashboard();",
        encoding="utf-8",
    )


def build_windows() -> Path:
    DIST.mkdir(parents=True, exist_ok=True)
    payload = DIST / "payload"
    if payload.exists():
        shutil.rmtree(payload)
    payload.mkdir(parents=True)
    for relative in ["Backend", "Docs", "Frontend", "product-manifest.json"]:
        source = ROOT / relative
        if not source.exists():
            continue
        target = payload / relative
        if source.is_dir():
            shutil.copytree(source, target, ignore=lambda directory, names: [n for n in names if _should_skip_file(Path(directory) / n)])
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)

    node_exe = shutil.which("node")
    if not node_exe:
        raise RuntimeError("Windows packaging requires a Node.js executable on PATH")
    node_runtime = payload / "node-runtime"
    node_runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(node_exe, node_runtime / "node.exe")

    runtime = payload / "Backend" / "AI_Runtime"
    runtime.mkdir(parents=True, exist_ok=True)
    _copy_runtime_node_modules(ROOT / "node_modules", runtime / "node_modules")

    # CRITICAL: package the real repository web application.
    # The generated demo web surface must never replace production UI.
    source_web = ROOT / "web"
    web = payload / "web"
    if not source_web.exists():
        raise RuntimeError(f"real web surface missing: {source_web}")
    if web.exists():
        shutil.rmtree(web)
    shutil.copytree(
        source_web,
        web,
        ignore=lambda directory, names: [
            n for n in names
            if n in {"node_modules", "__pycache__"} or n.endswith((".pyc", ".test", ".spec"))
        ],
    )
    for required_web_file in (web / "index.html", web / "app.js", web / "styles.css"):
        if not required_web_file.exists():
            raise RuntimeError(f"real customer web asset missing: {required_web_file}")

    (payload / "product-manifest.json").write_text('{"name":"HooshyarOS","runtime":"Backend/HBOS/Autonomous/Runtime/start-commercial-runtime.ts","health":"/health","web":"web/index.html"}', encoding="utf-8")
    _write_launch_surface(payload)
    _validate_windows_payload(payload)
    bootstrap = DIST / "HooshyarOS-Windows-Bootstrap.zip"
    with zipfile.ZipFile(bootstrap, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in payload.rglob("*"):
            if file.is_file():
                archive.write(file, file.relative_to(payload))
    return bootstrap


def main() -> int:
    build_windows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
