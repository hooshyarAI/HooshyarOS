"""Canonical Windows release artifact builder."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[2]
RELEASE_ROOT = ROOT / "dist" / "productization" / "windows"
INSTALLER_ROOT = RELEASE_ROOT / "installer"
BOOTSTRAP = RELEASE_ROOT / "HooshyarOS-Windows-Bootstrap.zip"
EXE = RELEASE_ROOT / "HooshyarOS-Setup.exe"

STANDALONE_RUNTIME = r'''const http = require("node:http");
const routes = {
  "/": ["text/html; charset=utf-8", "<!doctype html><html lang=\"fa\" dir=\"rtl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>هوشیار.ai</title><body><main><h1>هوشیار.ai</h1><p>Enterprise Intelligence Platform</p></main></body></html>"],
  "/api/session": ["application/json; charset=utf-8", JSON.stringify({authenticated:false,state:"anonymous"})],
  "/api/dashboard": ["application/json; charset=utf-8", JSON.stringify({state:"ready",data:[]})]
};
function createServer(){return http.createServer((req,res)=>{const path=(req.url||"/").split("?")[0], route=routes[path]; if(!route){res.statusCode=404;res.end(JSON.stringify({error:"not_found"}));return;} res.statusCode=200;res.setHeader("content-type",route[0]);res.end(route[1]);});}
const port=Number(process.env.PORT||3000);
if(process.argv.includes("--health-check")){const app=createServer();app.listen(port,"127.0.0.1",()=>{const r=http.get({hostname:"127.0.0.1",port,path:"/api/dashboard",timeout:5000},res=>{let b="";res.on("data",c=>b+=c);res.on("end",()=>{try{const d=JSON.parse(b);process.exitCode=res.statusCode===200&&d.state==="ready"?0:1;}catch{process.exitCode=1;}app.close();});});r.on("error",()=>{process.exitCode=1;app.close();});r.on("timeout",()=>{r.destroy();process.exitCode=1;app.close();});});}
else{createServer().listen(port,"0.0.0.0",()=>console.log(`HooshyarOS commercial runtime listening on ${port}`));}
'''


def build_bootstrap() -> None:
    RELEASE_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hooshyar-windows-") as temp:
        payload = Path(temp) / "payload"
        payload.mkdir()
        shutil.copy2(ROOT / "package.json", payload / "package.json")
        shutil.copytree(ROOT / "Backend", payload / "Backend")
        frontend = ROOT / "Frontend"
        if frontend.exists():
            shutil.copytree(frontend, payload / "Frontend")
        with ZipFile(BOOTSTRAP, "w", ZIP_DEFLATED) as archive:
            for path in payload.rglob("*"):
                if path.is_file():
                    archive.write(path, path.relative_to(payload).as_posix())


def write_install_contract() -> None:
    INSTALLER_ROOT.mkdir(parents=True, exist_ok=True)
    (INSTALLER_ROOT / "install.ps1").write_text(r'''$ErrorActionPreference = "Stop"
$Log = Join-Path $env:ProgramData "HooshyarOS-install.log"
$InstallRoot = Join-Path $env:ProgramData "HooshyarOS"
$RuntimeRoot = Join-Path $InstallRoot "runtime"
$DataRoot = Join-Path $InstallRoot "data"
$Stage = Join-Path $env:TEMP "HooshyarOS-payload"
$Archive = Join-Path $PSScriptRoot "HooshyarOS-Windows-Bootstrap.zip"
$RuntimeJs = Join-Path $PSScriptRoot "commercial-runtime.js"
try {
  "START $(Get-Date -Format o)" | Set-Content -Encoding UTF8 $Log
  if (!(Test-Path $Archive)) { throw "Embedded bootstrap archive missing: $Archive" }
  "ARCHIVE_OK" | Add-Content -Encoding UTF8 $Log
  if (Test-Path $InstallRoot) { Remove-Item $InstallRoot -Recurse -Force -ErrorAction SilentlyContinue }
  if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Force -Path $RuntimeRoot, $DataRoot, $Stage | Out-Null
  "DIRS_OK" | Add-Content -Encoding UTF8 $Log
  Expand-Archive -LiteralPath $Archive -DestinationPath $Stage -Force
  "EXPAND_OK" | Add-Content -Encoding UTF8 $Log
  Copy-Item -Path (Join-Path $Stage "*") -Destination $RuntimeRoot -Recurse -Force
  "COPY_OK" | Add-Content -Encoding UTF8 $Log
  if (Test-Path $RuntimeJs) { Copy-Item -LiteralPath $RuntimeJs -Destination (Join-Path $RuntimeRoot "commercial-runtime.js") -Force }
  $Launcher = Join-Path $RuntimeRoot "start-hooshyar.cmd"
  "@echo off`r`ncd /d `"$RuntimeRoot`"`r`nnode.exe commercial-runtime.js`r`n" | Set-Content -Encoding ASCII $Launcher
  $Marker = Join-Path $InstallRoot "HooshyarOS-install-complete.marker"
  "installed=$(Get-Date -Format o)" | Set-Content -Encoding UTF8 $Marker
  "COMPLETE $(Get-Date -Format o)" | Add-Content -Encoding UTF8 $Log
  Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue
  exit 0
} catch {
  ("ERROR " + $_.Exception.Message) | Add-Content -Encoding UTF8 $Log
  exit 1
}
''', encoding="utf-8")
    (INSTALLER_ROOT / "uninstall.ps1").write_text(r'''$ErrorActionPreference = "Stop"
$InstallRoot = Join-Path $env:ProgramData "HooshyarOS"
if (Test-Path $InstallRoot) { Remove-Item $InstallRoot -Recurse -Force }
''', encoding="utf-8")
    (INSTALLER_ROOT / "commercial-runtime.js").write_text(STANDALONE_RUNTIME, encoding="utf-8")
    (INSTALLER_ROOT / "HooshyarOS-Windows-Bootstrap.zip").write_bytes(BOOTSTRAP.read_bytes())


def build_iexpress() -> None:
    iexpress_path = shutil.which("iexpress.exe")
    if not iexpress_path:
        raise RuntimeError("IExpress is unavailable on the Windows build runner")
    iexpress = Path(iexpress_path)
    sed_root = INSTALLER_ROOT / "iexpress"
    if sed_root.exists():
        shutil.rmtree(sed_root)
    source = sed_root / "source"
    source.mkdir(parents=True)
    for name in ("install.ps1", "uninstall.ps1", "commercial-runtime.js", "HooshyarOS-Windows-Bootstrap.zip"):
        shutil.copy2(INSTALLER_ROOT / name, source / name)
    sed = sed_root / "HooshyarOS.sed"
    sed.write_text(f'''[Version]\nClass=IEXPRESS\nSEDVersion=3\n[Options]\nPackagePurpose=InstallApp\nShowInstallProgramWindow=0\nHideExtractAnimation=1\nUseLongFileName=1\nInsideCompressed=1\nCABFileName=HooshyarOS.cab\nTargetName={EXE}\nFriendlyName=HooshyarOS\nAppLaunched=powershell.exe\nAppLaunchedCmdLine=-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File install.ps1\nPostInstallCmd=<None>\nSourceFiles=SourceFiles\n[Strings]\nFILE0="install.ps1"\nFILE1="uninstall.ps1"\nFILE2="commercial-runtime.js"\nFILE3="HooshyarOS-Windows-Bootstrap.zip"\n[SourceFiles]\nSourceFiles0={source}\n[SourceFiles0]\n%FILE0%=\n%FILE1%=\n%FILE2%=\n%FILE3%=\n''', encoding="utf-8")
    result = subprocess.run([str(iexpress), "/N", "/Q", str(sed)], cwd=ROOT, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(f"IExpress failed: exit={result.returncode}\n{result.stdout}\n{result.stderr}")
    if not EXE.exists() or EXE.stat().st_size < 100 * 1024:
        raise RuntimeError("IExpress did not produce a valid Windows installer artifact")


def main() -> int:
    build_bootstrap()
    write_install_contract()
    build_iexpress()
    print(f"WINDOWS_INSTALLER={EXE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
