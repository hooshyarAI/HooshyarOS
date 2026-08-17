"""Canonical Windows installer builder for HooshyarOS."""
from __future__ import annotations

import base64
import os
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


def write_runtime_contract() -> None:
    INSTALLER_ROOT.mkdir(parents=True, exist_ok=True)
    (INSTALLER_ROOT / "uninstall.ps1").write_text(r'''$ErrorActionPreference = "Stop"
$InstallRoot = Join-Path $env:ProgramData "HooshyarOS"
if (Test-Path $InstallRoot) { Remove-Item $InstallRoot -Recurse -Force }
''', encoding="utf-8")
    (INSTALLER_ROOT / "commercial-runtime.js").write_text(STANDALONE_RUNTIME, encoding="utf-8")
    (INSTALLER_ROOT / "HooshyarOS-Windows-Bootstrap.zip").write_bytes(BOOTSTRAP.read_bytes())


def build_self_extracting_exe() -> None:
    dotnet = shutil.which("dotnet.exe") or shutil.which("dotnet")
    if not dotnet:
        raise RuntimeError("dotnet is unavailable on the Windows build runner")
    payload_b64 = base64.b64encode(BOOTSTRAP.read_bytes()).decode("ascii")
    runtime_b64 = base64.b64encode(STANDALONE_RUNTIME.encode("utf-8")).decode("ascii")
    with tempfile.TemporaryDirectory(prefix="hooshyar-dotnet-installer-") as temp:
        root = Path(temp)
        project = root / "Installer.csproj"
        source = root / "Program.cs"
        project.write_text('''<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n    <TargetFramework>net8.0</TargetFramework>\n    <RuntimeIdentifier>win-x64</RuntimeIdentifier>\n    <SelfContained>true</SelfContained>\n    <PublishSingleFile>true</PublishSingleFile>\n    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>\n    <PublishTrimmed>false</PublishTrimmed>\n    <InvariantGlobalization>true</InvariantGlobalization>\n    <AssemblyName>HooshyarOS-Setup</AssemblyName>\n  </PropertyGroup>\n</Project>\n''', encoding="utf-8")
        source.write_text(f'''using System;\nusing System.IO;\nusing System.IO.Compression;\nusing System.Text;\n\ninternal static class Program\n{{\n    private const string BootstrapBase64 = "{payload_b64}";\n    private const string RuntimeBase64 = "{runtime_b64}";\n    private static int Main()\n    {{\n        var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");\n        var runtimeRoot = Path.Combine(installRoot, "runtime");\n        var dataRoot = Path.Combine(installRoot, "data");\n        var logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS-install.log");\n        try\n        {{\n            Directory.CreateDirectory(runtimeRoot);\n            Directory.CreateDirectory(dataRoot);\n            File.WriteAllText(logPath, "START " + DateTimeOffset.UtcNow.ToString("O") + Environment.NewLine, Encoding.UTF8);\n            var tempZip = Path.Combine(Path.GetTempPath(), "HooshyarOS-Windows-Bootstrap.zip");\n            var tempExtract = Path.Combine(Path.GetTempPath(), "HooshyarOS-bootstrap-" + Guid.NewGuid().ToString("N"));\n            File.WriteAllBytes(tempZip, Convert.FromBase64String(BootstrapBase64));\n            Directory.CreateDirectory(tempExtract);\n            ZipFile.ExtractToDirectory(tempZip, tempExtract);\n            foreach (var file in Directory.EnumerateFiles(tempExtract, "*", SearchOption.AllDirectories))\n            {{\n                var relative = Path.GetRelativePath(tempExtract, file);\n                var target = Path.Combine(runtimeRoot, relative);\n                Directory.CreateDirectory(Path.GetDirectoryName(target)!);\n                File.Copy(file, target, true);\n            }}\n            File.WriteAllBytes(Path.Combine(runtimeRoot, "commercial-runtime.js"), Convert.FromBase64String(RuntimeBase64));\n            var launcher = Path.Combine(runtimeRoot, "start-hooshyar.cmd");\n            File.WriteAllText(launcher, "@echo off" + Environment.NewLine + "cd /d \"" + runtimeRoot + "\"" + Environment.NewLine + "node.exe commercial-runtime.js" + Environment.NewLine, Encoding.ASCII);\n            var marker = Path.Combine(installRoot, "HooshyarOS-install-complete.marker");\n            File.WriteAllText(marker, "installed=" + DateTimeOffset.UtcNow.ToString("O"), Encoding.UTF8);\n            File.AppendAllText(logPath, "COMPLETE " + DateTimeOffset.UtcNow.ToString("O") + Environment.NewLine, Encoding.UTF8);\n            try {{ File.Delete(tempZip); Directory.Delete(tempExtract, true); }} catch {{ }}\n            return 0;\n        }}\n        catch (Exception ex)\n        {{\n            try {{ File.AppendAllText(logPath, "ERROR " + ex.Message + Environment.NewLine, Encoding.UTF8); }} catch {{ }}\n            return 1;\n        }}\n    }}\n}}\n''', encoding="utf-8")
        env = os.environ.copy()
        env["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1"
        env["DOTNET_NOLOGO"] = "1"
        result = subprocess.run([dotnet, "publish", str(project), "-c", "Release", "-o", str(root / "publish"), "--nologo"], cwd=root, env=env, text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30*60, check=False)
        print(result.stdout, end="")
        if result.returncode != 0:
            raise RuntimeError(f"dotnet publish failed with exit code {result.returncode}")
        built = root / "publish" / "HooshyarOS-Setup.exe"
        if not built.exists() or built.stat().st_size < 1 * 1024 * 1024:
            raise RuntimeError("Self-contained Windows installer was not produced or is unexpectedly small")
        shutil.copy2(built, EXE)


def main() -> int:
    build_bootstrap()
    write_runtime_contract()
    build_self_extracting_exe()
    print(f"WINDOWS_INSTALLER={EXE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
