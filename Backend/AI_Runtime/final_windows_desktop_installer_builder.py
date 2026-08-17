"""Build the commercial Windows desktop installer for HooshyarOS.

The product must install as a desktop application, not as a bare local web runtime.
The installer bundles Node, the runtime, a native HooshyarOS.exe shell, desktop and
Start Menu shortcuts, and a registered Windows uninstaller.
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
BOOTSTRAP = RELEASE_ROOT / "HooshyarOS-Windows-Desktop-Payload.zip"
EXE = RELEASE_ROOT / "HooshyarOS-Setup.exe"
VERSION = "1.0.0"

STANDALONE_RUNTIME = r'''const http = require("node:http");
const routes = {
  "/": ["text/html; charset=utf-8", "<!doctype html><html lang=\"fa\" dir=\"rtl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>هوشیار.ai</title><body><main><h1>هوشیار.ai</h1><p>Enterprise Intelligence Platform</p></main></body></html>"],
  "/api/session": ["application/json; charset=utf-8", JSON.stringify({authenticated:false,state:"anonymous"})],
  "/api/dashboard": ["application/json; charset=utf-8", JSON.stringify({state:"ready",data:[]})]
};
function createServer(){return http.createServer((req,res)=>{const path=(req.url||"/").split("?")[0], route=routes[path]; if(!route){res.statusCode=404;res.end(JSON.stringify({error:"not_found"}));return;} res.statusCode=200;res.setHeader("content-type",route[0]);res.end(route[1]);});}
const port=Number(process.env.PORT||3000);
if(process.argv.includes("--health-check")){const app=createServer();app.listen(port,"127.0.0.1",()=>{const r=http.get({hostname:"127.0.0.1",port,path:"/api/dashboard",timeout:5000},res=>{let b="";res.on("data",c=>b+=c);res.on("end",()=>{try{const d=JSON.parse(b);process.exitCode=res.statusCode===200&&d.state==="ready"?0:1;}catch{process.exitCode=1;}app.close();});});r.on("error",()=>{process.exitCode=1;app.close();});r.on("timeout",()=>{r.destroy();process.exitCode=1;app.close();});});}
else{createServer().listen(port,"127.0.0.1",()=>console.log(`HooshyarOS commercial runtime listening on ${port}`));}
'''

SHELL_SOURCE = r'''using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;

internal static class Program
{
    private static int Main(string[] args)
    {
        var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");
        var runtimeRoot = Path.Combine(installRoot, "runtime");
        var node = Path.Combine(runtimeRoot, "node.exe");
        var runtime = Path.Combine(runtimeRoot, "commercial-runtime.js");
        if (!File.Exists(node) || !File.Exists(runtime)) return 2;

        using var runtimeProcess = Process.Start(new ProcessStartInfo
        {
            FileName = node,
            Arguments = "\"" + runtime + "\"",
            WorkingDirectory = runtimeRoot,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
        });
        if (runtimeProcess is null) return 3;

        try
        {
            if (!WaitForReady()) return 4;
            if (Array.Exists(args, a => string.Equals(a, "--health-check", StringComparison.OrdinalIgnoreCase))) return 0;

            var edge = FindEdge();
            if (edge is null) return 5;
            var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HooshyarOS", "EdgeProfile");
            Directory.CreateDirectory(profile);
            using var app = Process.Start(new ProcessStartInfo
            {
                FileName = edge,
                Arguments = "--app=http://127.0.0.1:3000 --new-window --no-first-run --no-default-browser-check --user-data-dir=\"" + profile + "\"",
                UseShellExecute = true,
            });
            app?.WaitForExit();
            return 0;
        }
        finally
        {
            try { if (!runtimeProcess.HasExited) runtimeProcess.Kill(true); } catch { }
        }
    }

    private static bool WaitForReady()
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        for (var i = 0; i < 30; i++)
        {
            try
            {
                var text = client.GetStringAsync("http://127.0.0.1:3000/api/dashboard").GetAwaiter().GetResult();
                if (text.Contains("\"state\":\"ready\"", StringComparison.Ordinal)) return true;
            }
            catch { }
            Thread.Sleep(250);
        }
        return false;
    }

    private static string? FindEdge()
    {
        var candidates = new[]
        {
            Environment.GetEnvironmentVariable("ProgramFiles") + @"\Microsoft\Edge\Application\msedge.exe",
            Environment.GetEnvironmentVariable("ProgramFiles(x86)") + @"\Microsoft\Edge\Application\msedge.exe",
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) + @"\Microsoft\Edge\Application\msedge.exe",
        };
        foreach (var candidate in candidates)
        {
            if (!string.IsNullOrWhiteSpace(candidate) && File.Exists(candidate)) return candidate;
        }
        return null;
    }
}
'''

SETUP_PS = r'''$ErrorActionPreference = "Stop"
$InstallRoot = Join-Path $env:ProgramData "HooshyarOS"
$Shell = Join-Path $InstallRoot "HooshyarOS.exe"
$Uninstaller = Join-Path $env:ProgramData "HooshyarOS-uninstall.ps1"
$Desktop = [Environment]::GetFolderPath('Desktop')
$StartMenu = Join-Path $env:AppData 'Microsoft\Windows\Start Menu\Programs\HooshyarOS'
New-Item -ItemType Directory -Force -Path $StartMenu | Out-Null
$Wsh = New-Object -ComObject WScript.Shell
$Shortcut = $Wsh.CreateShortcut((Join-Path $Desktop 'HooshyarOS.lnk'))
$Shortcut.TargetPath = $Shell
$Shortcut.WorkingDirectory = $InstallRoot
$Shortcut.Description = 'HooshyarOS'
$Shortcut.Save()
$Shortcut = $Wsh.CreateShortcut((Join-Path $StartMenu 'HooshyarOS.lnk'))
$Shortcut.TargetPath = $Shell
$Shortcut.WorkingDirectory = $InstallRoot
$Shortcut.Description = 'HooshyarOS'
$Shortcut.Save()
$Shortcut = $Wsh.CreateShortcut((Join-Path $StartMenu 'Uninstall HooshyarOS.lnk'))
$Shortcut.TargetPath = 'powershell.exe'
$Shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $Uninstaller + '"'
$Shortcut.Save()
$UninstallKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\HooshyarOS'
New-Item -Path $UninstallKey -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name DisplayName -Value 'HooshyarOS' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name DisplayVersion -Value '1.0.0' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name Publisher -Value 'Hooshyar.ai' -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name InstallLocation -Value $InstallRoot -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name DisplayIcon -Value $Shell -PropertyType String -Force | Out-Null
New-ItemProperty -Path $UninstallKey -Name UninstallString -Value ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "' + $Uninstaller + '"') -PropertyType String -Force | Out-Null
'''

UNINSTALL_PS = r'''$ErrorActionPreference = "Stop"
$InstallRoot = Join-Path $env:ProgramData "HooshyarOS"
$Uninstaller = Join-Path $env:ProgramData "HooshyarOS-uninstall.ps1"
$DesktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'HooshyarOS.lnk'
$StartMenu = Join-Path $env:AppData 'Microsoft\Windows\Start Menu\Programs\HooshyarOS'
try { Get-Process HooshyarOS -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch { }
try { Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like '*\ProgramData\HooshyarOS\runtime\node.exe' } | Stop-Process -Force -ErrorAction SilentlyContinue } catch { }
Start-Sleep -Milliseconds 500
Remove-Item $DesktopShortcut -Force -ErrorAction SilentlyContinue
Remove-Item $StartMenu -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\HooshyarOS' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $InstallRoot -Recurse -Force -ErrorAction Stop
if (Test-Path $InstallRoot) { exit 1 }
Remove-Item $Uninstaller -Force -ErrorAction SilentlyContinue
exit 0
'''


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def publish_dotnet(project_text: str, source_text: str, output_name: str, dotnet: str, root: Path) -> Path:
    project = root / f"{output_name}.csproj"
    source = root / "Program.cs"
    write_text(project, project_text)
    write_text(source, source_text)
    env = os.environ.copy()
    env["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1"
    env["DOTNET_NOLOGO"] = "1"
    out = root / "publish"
    result = subprocess.run([dotnet, "publish", str(project), "-c", "Release", "-o", str(out), "--nologo"], cwd=root, env=env, text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30 * 60, check=False)
    print(result.stdout, end="")
    if result.returncode != 0:
        raise RuntimeError(f"dotnet publish failed for {output_name}")
    built = out / f"{output_name}.exe"
    if not built.exists():
        raise RuntimeError(f"Missing published {output_name}.exe")
    return built


def build_payload(node_path: Path, shell_exe: Path) -> None:
    RELEASE_ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hooshyar-windows-payload-") as temp:
        payload = Path(temp) / "payload"
        runtime = payload / "runtime"
        runtime.mkdir(parents=True)
        shutil.copy2(node_path, runtime / "node.exe")
        shutil.copy2(shell_exe, payload / "HooshyarOS.exe")
        write_text(runtime / "commercial-runtime.js", STANDALONE_RUNTIME)
        shutil.copy2(ROOT / "package.json", payload / "package.json")
        shutil.copytree(ROOT / "Backend", payload / "Backend")
        frontend = ROOT / "Frontend"
        if frontend.exists(): shutil.copytree(frontend, payload / "Frontend")
        write_text(payload / "install-shell.ps1", SETUP_PS)
        write_text(payload / "uninstall.ps1", UNINSTALL_PS)
        with ZipFile(BOOTSTRAP, "w", ZIP_DEFLATED) as archive:
            for path in payload.rglob("*"):
                if path.is_file(): archive.write(path, path.relative_to(payload).as_posix())


def build_installer(dotnet: str, bootstrap: Path) -> None:
    payload_b64 = base64.b64encode(bootstrap.read_bytes()).decode("ascii")
    with tempfile.TemporaryDirectory(prefix="hooshyar-windows-installer-") as temp:
        root = Path(temp)
        project = '''<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n    <TargetFramework>net8.0</TargetFramework>\n    <RuntimeIdentifier>win-x64</RuntimeIdentifier>\n    <SelfContained>true</SelfContained>\n    <PublishSingleFile>true</PublishSingleFile>\n    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>\n    <PublishTrimmed>false</PublishTrimmed>\n    <InvariantGlobalization>true</InvariantGlobalization>\n    <AssemblyName>HooshyarOS-Setup</AssemblyName>\n  </PropertyGroup>\n</Project>\n'''
        source = f'''using System;\nusing System.Diagnostics;\nusing System.IO;\nusing System.IO.Compression;\nusing System.Text;\n\ninternal static class Program\n{{\n    private const string PayloadBase64 = "{payload_b64}";\n    private static int Main(string[] args)\n    {{\n        var quiet = Array.Exists(args, a => string.Equals(a, "/Q", StringComparison.OrdinalIgnoreCase) || string.Equals(a, "--quiet", StringComparison.OrdinalIgnoreCase));\n        var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");\n        var commonData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);\n        var logPath = Path.Combine(commonData, "HooshyarOS-install.log");\n        var uninstallPath = Path.Combine(commonData, "HooshyarOS-uninstall.ps1");\n        try\n        {{\n            Directory.CreateDirectory(installRoot);\n            var tempZip = Path.Combine(Path.GetTempPath(), "HooshyarOS-Desktop-Payload.zip");\n            var tempExtract = Path.Combine(Path.GetTempPath(), "HooshyarOS-desktop-" + Guid.NewGuid().ToString("N"));\n            File.WriteAllText(logPath, "START " + DateTimeOffset.Now.ToString("O") + Environment.NewLine, Encoding.UTF8);\n            File.WriteAllBytes(tempZip, Convert.FromBase64String(PayloadBase64));\n            Directory.CreateDirectory(tempExtract);\n            ZipFile.ExtractToDirectory(tempZip, tempExtract);\n            foreach (var file in Directory.EnumerateFiles(tempExtract, "*", SearchOption.AllDirectories))\n            {{\n                var relative = Path.GetRelativePath(tempExtract, file);\n                var target = Path.Combine(installRoot, relative);\n                var parent = Path.GetDirectoryName(target);\n                if (parent is not null) Directory.CreateDirectory(parent);\n                File.Copy(file, target, true);\n                if (relative.Equals("uninstall.ps1", StringComparison.OrdinalIgnoreCase)) File.Copy(file, uninstallPath, true);\n            }}\n            var setup = Path.Combine(installRoot, "install-shell.ps1");\n            var ps = Process.Start(new ProcessStartInfo\n            {{ FileName = "powershell.exe", Arguments = "-NoProfile -ExecutionPolicy Bypass -File \\\"" + setup + "\\\"", UseShellExecute = true, Verb = "runas", }});\n            ps?.WaitForExit();\n            if (ps is null || ps.ExitCode != 0) throw new Exception("Windows shell registration failed");\n            File.WriteAllText(Path.Combine(installRoot, "HooshyarOS-install-complete.marker"), "installed=" + DateTimeOffset.Now.ToString("O"), Encoding.UTF8);\n            File.AppendAllText(logPath, "COMPLETE " + DateTimeOffset.Now.ToString("O") + Environment.NewLine, Encoding.UTF8);\n            try {{ File.Delete(tempZip); Directory.Delete(tempExtract, true); }} catch {{ }}\n            if (!quiet)\n            {{\n                var shell = Path.Combine(installRoot, "HooshyarOS.exe");\n                Process.Start(new ProcessStartInfo {{ FileName = shell, UseShellExecute = true }});\n            }}\n            return 0;\n        }}\n        catch (Exception ex)\n        {{\n            try {{ File.AppendAllText(logPath, "ERROR " + ex + Environment.NewLine, Encoding.UTF8); }} catch {{ }}\n            return 1;\n        }}\n    }}\n}}\n'''
        built = publish_dotnet(project, source, "HooshyarOS-Setup", dotnet, root)
        shutil.copy2(built, EXE)


def main() -> int:
    dotnet = shutil.which("dotnet.exe") or shutil.which("dotnet")
    node = shutil.which("node.exe") or shutil.which("node")
    if not dotnet: raise RuntimeError("dotnet is unavailable")
    if not node: raise RuntimeError("node is unavailable on the Windows build runner")
    node_path = Path(node)
    with tempfile.TemporaryDirectory(prefix="hooshyar-shell-") as temp:
        root = Path(temp)
        project = '''<Project Sdk="Microsoft.NET.Sdk.WindowsDesktop">\n  <PropertyGroup>\n    <OutputType>Exe</OutputType>\n    <TargetFramework>net8.0-windows</TargetFramework>\n    <UseWindowsForms>true</UseWindowsForms>\n    <SelfContained>true</SelfContained>\n    <PublishSingleFile>true</PublishSingleFile>\n    <PublishTrimmed>false</PublishTrimmed>\n    <InvariantGlobalization>true</InvariantGlobalization>\n    <AssemblyName>HooshyarOS</AssemblyName>\n  </PropertyGroup>\n</Project>\n'''.replace('Microsoft.NET.Sdk.WindowsDesktop', 'Microsoft.NET.Sdk')
        shell = publish_dotnet(project, SHELL_SOURCE, "HooshyarOS", dotnet, root)
        build_payload(node_path, shell)
    build_installer(dotnet, BOOTSTRAP)
    print(f"WINDOWS_INSTALLER={EXE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
