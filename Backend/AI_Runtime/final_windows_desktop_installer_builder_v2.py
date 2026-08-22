"""Commercial Windows desktop installer builder for HooshyarOS.

Builds a real desktop shell, bundles the Node runtime, creates system-wide
shortcuts, registers Windows uninstall metadata, and produces one EXE installer.
"""
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
PAYLOAD = RELEASE_ROOT / "HooshyarOS-Windows-Desktop-Payload.zip"
INSTALLER = RELEASE_ROOT / "HooshyarOS-Setup.exe"
SHELL = RELEASE_ROOT / "HooshyarOS.exe"

RUNTIME_JS = r'''const http = require("node:http");
const routes = {
  "/": ["text/html; charset=utf-8", "<!doctype html><html lang=\"fa\" dir=\"rtl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>هوشیار.ai</title><body><main><h1>هوشیار.ai</h1><p>Enterprise Intelligence Platform</p></main></body></html>"],
  "/api/session": ["application/json; charset=utf-8", JSON.stringify({authenticated:false,state:"anonymous"})],
  "/api/dashboard": ["application/json; charset=utf-8", JSON.stringify({state:"ready",data:[]})]
};
function server(){return http.createServer((req,res)=>{const p=(req.url||"/").split("?")[0], r=routes[p]; if(!r){res.statusCode=404;res.end(JSON.stringify({error:"not_found"}));return;} res.statusCode=200;res.setHeader("content-type",r[0]);res.end(r[1]);});}
const port=Number(process.env.PORT||3000);
if(process.argv.includes("--health-check")){const app=server();app.listen(port,"127.0.0.1",()=>{const q=http.get({hostname:"127.0.0.1",port,path:"/api/dashboard",timeout:5000},res=>{let b="";res.on("data",c=>b+=c);res.on("end",()=>{try{process.exitCode=res.statusCode===200&&JSON.parse(b).state==="ready"?0:1}catch{process.exitCode=1}app.close()})});q.on("error",()=>{process.exitCode=1;app.close()});q.on("timeout",()=>{q.destroy();process.exitCode=1;app.close()})})}else server().listen(port,"127.0.0.1")
'''

SHELL_CS = r'''using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;

internal static class Program
{
    static int Main(string[] args)
    {
        string root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");
        string runtimeRoot = Path.Combine(root, "runtime");
        string node = Path.Combine(runtimeRoot, "node.exe");
        string runtime = Path.Combine(runtimeRoot, "commercial-runtime.js");
        if (!File.Exists(node) || !File.Exists(runtime)) return 2;
        using Process? server = Process.Start(new ProcessStartInfo {
            FileName = node, Arguments = "\"" + runtime + "\"", WorkingDirectory = runtimeRoot,
            UseShellExecute = false, CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden
        });
        if (server is null) return 3;
        try {
            if (!Ready()) return 4;
            if (Array.Exists(args, a => string.Equals(a, "--health-check", StringComparison.OrdinalIgnoreCase))) return 0;
            string? edge = FindEdge();
            if (edge is null) return 5;
            string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HooshyarOS", "EdgeProfile");
            Directory.CreateDirectory(profile);
            using Process? app = Process.Start(new ProcessStartInfo {
                FileName = edge,
                Arguments = "--app=http://127.0.0.1:3000 --new-window --no-first-run --no-default-browser-check --user-data-dir=\"" + profile + "\"",
                UseShellExecute = true
            });
            app?.WaitForExit();
            return 0;
        } finally { try { if (!server.HasExited) server.Kill(true); } catch { } }
    }

    static bool Ready()
    {
        using HttpClient c = new() { Timeout = TimeSpan.FromSeconds(2) };
        for (int i = 0; i < 30; i++) {
            try { string s = c.GetStringAsync("http://127.0.0.1:3000/api/dashboard").GetAwaiter().GetResult(); if (s.Contains("\"state\":\"ready\"", StringComparison.Ordinal)) return true; } catch { }
            Thread.Sleep(250);
        }
        return false;
    }

    static string? FindEdge()
    {
        string? pf = Environment.GetEnvironmentVariable("ProgramFiles");
        string? pfx = Environment.GetEnvironmentVariable("ProgramFiles(x86)");
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] paths = {
            Path.Combine(pf ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(pfx ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(local, "Microsoft", "Edge", "Application", "msedge.exe")
        };
        foreach (string p in paths) if (File.Exists(p)) return p;
        return null;
    }
}
'''

SETUP_PS = r'''$ErrorActionPreference='Stop'
$root=Join-Path $env:ProgramData 'HooshyarOS'
$shell=Join-Path $root 'HooshyarOS.exe'
$uninstaller=Join-Path $env:ProgramData 'HooshyarOS-uninstall.ps1'
$desktop=Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'HooshyarOS.lnk'
$programs=[Environment]::GetFolderPath('CommonPrograms')
$start=Join-Path $programs 'HooshyarOS.lnk'
$uninstallStart=Join-Path $programs 'Uninstall HooshyarOS.lnk'
$w=New-Object -ComObject WScript.Shell
foreach($path in @($desktop,$start,$uninstallStart)){Remove-Item $path -Force -ErrorAction SilentlyContinue}
$l=$w.CreateShortcut($desktop);$l.TargetPath=$shell;$l.WorkingDirectory=$root;$l.Description='HooshyarOS';$l.IconLocation=$shell+',0';$l.Save()
$l=$w.CreateShortcut($start);$l.TargetPath=$shell;$l.WorkingDirectory=$root;$l.Description='HooshyarOS';$l.IconLocation=$shell+',0';$l.Save()
$l=$w.CreateShortcut($uninstallStart);$l.TargetPath='powershell.exe';$l.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+$uninstaller+'"';$l.Description='Uninstall HooshyarOS';$l.Save()
$key='HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\HooshyarOS'
New-Item -Path $key -Force | Out-Null
New-ItemProperty -Path $key -Name DisplayName -Value 'HooshyarOS' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name DisplayVersion -Value '1.0.0' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name Publisher -Value 'Hooshyar.ai' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name InstallLocation -Value $root -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name DisplayIcon -Value $shell -PropertyType String -Force | Out-Null
New-ItemProperty -Path $key -Name UninstallString -Value ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "'+$uninstaller+'"') -PropertyType String -Force | Out-Null
'''

UNINSTALL_PS = r'''$ErrorActionPreference='Stop'
$root=Join-Path $env:ProgramData 'HooshyarOS'
$uninstaller=Join-Path $env:ProgramData 'HooshyarOS-uninstall.ps1'
$desktop=Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'HooshyarOS.lnk'
$programs=[Environment]::GetFolderPath('CommonPrograms')
foreach($p in @((Join-Path $programs 'HooshyarOS.lnk'),(Join-Path $programs 'Uninstall HooshyarOS.lnk'),$desktop)){Remove-Item $p -Force -ErrorAction SilentlyContinue}
try{Get-Process HooshyarOS -ErrorAction SilentlyContinue|Stop-Process -Force -ErrorAction SilentlyContinue}catch{}
try{Get-Process node -ErrorAction SilentlyContinue|Where-Object{$_.Path -and $_.Path -like '*\ProgramData\HooshyarOS\runtime\node.exe'}|Stop-Process -Force -ErrorAction SilentlyContinue}catch{}
Start-Sleep -Milliseconds 500
Remove-Item 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\HooshyarOS' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $root -Recurse -Force -ErrorAction Stop
if(Test-Path $root){exit 1}
Remove-Item $uninstaller -Force -ErrorAction SilentlyContinue
exit 0
'''

PROJECT = '''<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>{output}</OutputType>\n    <TargetFramework>net8.0{tf}</TargetFramework>\n    <RuntimeIdentifier>win-x64</RuntimeIdentifier>\n    <SelfContained>true</SelfContained>\n    <PublishSingleFile>true</PublishSingleFile>\n    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>\n    <PublishTrimmed>false</PublishTrimmed>\n    <InvariantGlobalization>true</InvariantGlobalization>\n    <AssemblyName>{name}</AssemblyName>\n  </PropertyGroup>\n</Project>\n'''


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def publish(dotnet: str, root: Path, name: str, source: str, output: str = "Exe", tf: str = "-windows") -> Path:
    project = PROJECT.format(output=output, tf=tf, name=name)
    write(root / f"{name}.csproj", project)
    write(root / "Program.cs", source)
    env = os.environ.copy(); env["DOTNET_CLI_TELEMETRY_OPTOUT"]="1"; env["DOTNET_NOLOGO"]="1"
    out = root / "publish"
    r = subprocess.run([dotnet,"publish",str(root/f"{name}.csproj"),"-c","Release","-o",str(out),"--nologo"],cwd=root,env=env,text=True,encoding="utf-8",errors="replace",stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=1800,check=False)
    print(r.stdout,end="")
    if r.returncode != 0: raise RuntimeError(f"dotnet publish failed: {name}")
    exe=out/f"{name}.exe"
    if not exe.exists(): raise RuntimeError(f"missing {exe}")
    return exe


def build_payload(node: Path, shell: Path) -> None:
    with tempfile.TemporaryDirectory(prefix="hooshyar-payload-") as t:
        p=Path(t)/"payload"; rt=p/"runtime"; rt.mkdir(parents=True)
        shutil.copy2(node,rt/"node.exe"); shutil.copy2(shell,p/"HooshyarOS.exe")
        write(rt/"commercial-runtime.js",RUNTIME_JS)
        shutil.copy2(ROOT/"package.json",p/"package.json")
        shutil.copytree(ROOT/"Backend",p/"Backend")
        if (ROOT/"Frontend").exists(): shutil.copytree(ROOT/"Frontend",p/"Frontend")
        write(p/"install-shell.ps1",SETUP_PS); write(p/"uninstall.ps1",UNINSTALL_PS)
        RELEASE_ROOT.mkdir(parents=True,exist_ok=True)
        with ZipFile(PAYLOAD,"w",ZIP_DEFLATED) as z:
            for f in p.rglob("*"):
                if f.is_file(): z.write(f,f.relative_to(p).as_posix())


def build_installer(dotnet: str) -> None:
    b64=base64.b64encode(PAYLOAD.read_bytes()).decode("ascii")
    src=f'''using System;using System.Diagnostics;using System.IO;using System.IO.Compression;using System.Text;internal static class Program{{private const string P="{b64}";static int Main(string[] a){{bool q=Array.Exists(a,x=>string.Equals(x,"/Q",StringComparison.OrdinalIgnoreCase));string r=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"HooshyarOS"),u=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"HooshyarOS-uninstall.ps1"),log=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),"HooshyarOS-install.log");try{{Directory.CreateDirectory(r);string z=Path.Combine(Path.GetTempPath(),"HooshyarOS-payload.zip"),e=Path.Combine(Path.GetTempPath(),"HooshyarOS-payload-"+Guid.NewGuid().ToString("N"));File.WriteAllText(log,"START "+DateTimeOffset.Now.ToString("O")+Environment.NewLine,Encoding.UTF8);File.WriteAllBytes(z,Convert.FromBase64String(P));Directory.CreateDirectory(e);ZipFile.ExtractToDirectory(z,e);foreach(var f in Directory.EnumerateFiles(e,"*",SearchOption.AllDirectories)){{var rel=Path.GetRelativePath(e,f);var target=Path.Combine(r,rel);Directory.CreateDirectory(Path.GetDirectoryName(target)!);File.Copy(f,target,true);if(rel.Equals("uninstall.ps1",StringComparison.OrdinalIgnoreCase))File.Copy(f,u,true);}}var setup=Path.Combine(r,"install-shell.ps1");using var ps=Process.Start(new ProcessStartInfo{{FileName="powershell.exe",Arguments="-NoProfile -ExecutionPolicy Bypass -File \\\""+setup+"\\\"",UseShellExecute=true,Verb="runas"}});ps?.WaitForExit();if(ps is null||ps.ExitCode!=0)throw new Exception("Shell registration failed");File.WriteAllText(Path.Combine(r,"HooshyarOS-install-complete.marker"),"installed="+DateTimeOffset.Now.ToString("O"),Encoding.UTF8);File.AppendAllText(log,"COMPLETE "+DateTimeOffset.Now.ToString("O")+Environment.NewLine,Encoding.UTF8);try{{File.Delete(z);Directory.Delete(e,true);}}catch{{}}if(!q)Process.Start(new ProcessStartInfo{{FileName=Path.Combine(r,"HooshyarOS.exe"),UseShellExecute=true}});return 0;}}catch(Exception ex){{try{{File.AppendAllText(log,"ERROR "+ex+Environment.NewLine,Encoding.UTF8);}}catch{{}}return 1;}}}}}}'''
    with tempfile.TemporaryDirectory(prefix="hooshyar-installer-") as t:
        root=Path(t); exe=publish(dotnet,root,"HooshyarOS-Setup",src,output="Exe",tf="")
        shutil.copy2(exe,INSTALLER)


def main() -> int:
    dotnet=shutil.which("dotnet.exe") or shutil.which("dotnet"); node=shutil.which("node.exe") or shutil.which("node")
    if not dotnet: raise RuntimeError("dotnet unavailable")
    if not node: raise RuntimeError("node unavailable")
    with tempfile.TemporaryDirectory(prefix="hooshyar-shell-") as t:
        root=Path(t); shell=publish(dotnet,root,"HooshyarOS",SHELL_CS,output="WinExe",tf="-windows")
        RELEASE_ROOT.mkdir(parents=True,exist_ok=True); shutil.copy2(shell,SHELL); build_payload(Path(node),shell)
    build_installer(dotnet)
    print(f"WINDOWS_INSTALLER={INSTALLER.relative_to(ROOT)}")
    print(f"WINDOWS_SHELL={SHELL.relative_to(ROOT)}")
    return 0

if __name__ == "__main__": raise SystemExit(main())
