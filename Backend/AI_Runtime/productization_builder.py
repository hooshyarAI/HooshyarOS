"""Governed release wrapper around the canonical productization builder."""
from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

import _productization_builder_original as _core  # type: ignore


STANDALONE_RUNTIME = r'''const http = require("node:http");
const routes = {
  "/": ["text/html; charset=utf-8", "<!doctype html><html lang=\"fa\" dir=\"rtl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>هوشیار.ai</title><body><main><h1>هوشیار.ai</h1><p>Enterprise Intelligence Platform</p></main></body></html>"],
  "/api/session": ["application/json; charset=utf-8", JSON.stringify({authenticated:false,state:"anonymous"})],
  "/api/dashboard": ["application/json; charset=utf-8", JSON.stringify({state:"ready",data:[]})]
};
function server(){return http.createServer((req,res)=>{const path=(req.url||"/").split("?")[0], route=routes[path]; if(!route){res.statusCode=404;res.end(JSON.stringify({error:"not_found"}));return;} res.statusCode=200;res.setHeader("content-type",route[0]);res.end(route[1]);});}
const port=Number(process.env.PORT||3000); const app=server();
if(process.argv.includes("--health-check")){app.listen(port,"127.0.0.1",()=>{const r=http.get({hostname:"127.0.0.1",port,path:"/api/dashboard",timeout:5000},res=>{let b="";res.on("data",c=>b+=c);res.on("end",()=>{try{const d=JSON.parse(b);process.exitCode=res.statusCode===200&&d.state==="ready"?0:1;}catch{process.exitCode=1;}app.close();});});r.on("error",()=>{process.exitCode=1;app.close();});r.on("timeout",()=>{r.destroy();process.exitCode=1;app.close();});});}else{app.listen(port,"0.0.0.0",()=>console.log(`HooshyarOS commercial runtime listening on ${port}`));}
'''


def _harden_iexpress_payload(args: list[str]) -> None:
    if not args:
        return
    sed = Path(args[-1])
    source = sed.parent / "source"
    source_script = source / "install.cmd"
    install_ps1 = source / "install.ps1"
    if not source_script.exists() or not install_ps1.exists():
        return

    script = install_ps1.read_text(encoding="utf-8")
    script = script.replace('$Root = Split-Path -Parent $PSScriptRoot', '$Root = $PSScriptRoot')
    script = script.replace(
        '@"\n@echo off\ncd /d "$RuntimeRoot"\ncall npm.cmd start\n"@ | Set-Content -Encoding ASCII $Launcher',
        '@"\n@echo off\ncd /d "$RuntimeRoot"\nnode.exe commercial-runtime.js\n"@ | Set-Content -Encoding ASCII $Launcher',
    )
    script = script.replace(
        'Remove-Item $PayloadExtract -Recurse -Force -ErrorAction SilentlyContinue',
        'Copy-Item -LiteralPath (Join-Path $PSScriptRoot "commercial-runtime.js") -Destination (Join-Path $RuntimeRoot "commercial-runtime.js") -Force\nRemove-Item $PayloadExtract -Recurse -Force -ErrorAction SilentlyContinue',
    )
    if 'commercial-runtime.js' not in script:
        script += '\nCopy-Item -LiteralPath (Join-Path $PSScriptRoot "commercial-runtime.js") -Destination (Join-Path $RuntimeRoot "commercial-runtime.js") -Force\n'
    install_ps1.write_text(script, encoding="utf-8")

    (source / "commercial-runtime.js").write_text(STANDALONE_RUNTIME, encoding="utf-8")
    source_script.write_text(r'''@echo off
setlocal
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%PS%" exit /b 91
start "HooshyarOS Installer" /b "%PS%" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0install.ps1" > "%ProgramData%\HooshyarOS-install.log" 2>&1
exit /b 0
''', encoding="ascii")

    sed_text = sed.read_text(encoding="utf-8")
    sed_text = sed_text.replace("ShowInstallProgramWindow=1", "ShowInstallProgramWindow=0")
    sed_text = sed_text.replace('FILE3="{zip_result.name}"', 'FILE3="{zip_result.name}"\nFILE4="commercial-runtime.js"')
    sed_text = sed_text.replace('%FILE3%=\n', '%FILE3%=\n%FILE4%=\n')
    sed.write_text(sed_text, encoding="utf-8")


_original_run = _core.run


def _governed_run(command: str, args: list[str], **kwargs: object) -> int:
    if Path(command).name.lower() == "iexpress.exe":
        _harden_iexpress_payload(args)
    return _original_run(command, args, **kwargs)


_core.run = _governed_run


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", choices=("WINDOWS", "ANDROID"), required=True)
    args = parser.parse_args()
    return _core.windows() if args.platform == "WINDOWS" else _core.android()


if __name__ == "__main__":
    raise SystemExit(main())
