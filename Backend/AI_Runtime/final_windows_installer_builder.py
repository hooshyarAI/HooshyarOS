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
DESKTOP_SHELL = RELEASE_ROOT / "HooshyarOS.exe"

STANDALONE_RUNTIME = r'''const http = require("node:http");
const routes = {
  "/": ["text/html; charset=utf-8", "<!doctype html><html lang=\"fa\" dir=\"rtl\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Hooshyar.ai</title><body><main><h1>Hooshyar.ai</h1><p>Enterprise Intelligence Platform</p></main></body></html>"],
  "/api/session": ["application/json; charset=utf-8", JSON.stringify({authenticated:false,state:"anonymous"})],
  "/api/dashboard": ["application/json; charset=utf-8", JSON.stringify({state:"ready",data:[]})]
};
function createServer(){return http.createServer((req,res)=>{const path=(req.url||"/").split("?")[0], route=routes[path]; if(!route){res.statusCode=404;res.end(JSON.stringify({error:"not_found"}));return;} res.statusCode=200;res.setHeader("content-type",route[0]);res.end(route[1]);});}
const port=Number(process.env.PORT||3000);
if(process.argv.includes("--health-check")){const app=createServer();app.listen(port,"127.0.0.1",()=>{const r=http.get({hostname:"127.0.0.1",port,path:"/api/dashboard",timeout:5000},res=>{let b="";res.on("data",c=>b+=c);res.on("end",()=>{try{const d=JSON.parse(b);process.exitCode=res.statusCode===200&&d.state==="ready"?0:1;}catch{process.exitCode=1;}app.close();});});r.on("error",()=>{process.exitCode=1;app.close();});r.on("timeout",()=>{r.destroy();process.exitCode=1;app.close();});});}
else{createServer().listen(port,"127.0.0.1",()=>console.log(`HooshyarOS commercial runtime listening on ${port}`));}
'''


def build_desktop_shell() -> None:
    dotnet = shutil.which("dotnet.exe") or shutil.which("dotnet")
    if not dotnet:
        raise RuntimeError("dotnet is unavailable on the Windows build runner")
    source = r'''
using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}

internal sealed class MainForm : Form
{
    private readonly WebView2 _web = new() { Dock = DockStyle.Fill };
    private Process? _runtime;

    public MainForm()
    {
        Text = "Hooshyar.ai";
        Width = 1400;
        Height = 900;
        MinimumSize = new System.Drawing.Size(1024, 700);
        StartPosition = FormStartPosition.CenterScreen;
        Controls.Add(_web);
        Shown += async (_, _) => await StartAsync();
        FormClosing += (_, _) => StopRuntime();
    }

    private async System.Threading.Tasks.Task StartAsync()
    {
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");
        var runtime = Path.Combine(root, "runtime");
        var node = Path.Combine(runtime, "node.exe");
        var app = Path.Combine(runtime, "commercial-runtime.js");
        if (!Ready())
        {
            if (!File.Exists(node) || !File.Exists(app))
            {
                MessageBox.Show("HooshyarOS runtime is incomplete. Please repair or reinstall the application.", "Hooshyar.ai", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            _runtime = Process.Start(new ProcessStartInfo
            {
                FileName = node,
                Arguments = $"\"{app}\"",
                WorkingDirectory = runtime,
                UseShellExecute = false,
                CreateNoWindow = true
            });
        }
        await _web.EnsureCoreWebView2Async();
        _web.Source = new Uri("http://127.0.0.1:3000/");
    }

    private static bool Ready()
    {
        try
        {
            using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };
            var r = client.GetAsync("http://127.0.0.1:3000/api/dashboard").GetAwaiter().GetResult();
            return r.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    private void StopRuntime()
    {
        try { if (_runtime is { HasExited: false }) _runtime.Kill(true); } catch { }
    }
}
'''
    csproj = r'''<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <SelfContained>true</SelfContained>
    <PublishSingleFile>true</PublishSingleFile>
    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
    <PublishTrimmed>false</PublishTrimmed>
    <InvariantGlobalization>true</InvariantGlobalization>
    <AssemblyName>HooshyarOS</AssemblyName>
  </PropertyGroup>
</Project>
'''
    with tempfile.TemporaryDirectory(prefix="hooshyar-shell-") as temp:
        root = Path(temp)
        (root / "HooshyarOS.csproj").write_text(csproj, encoding="utf-8")
        (root / "Program.cs").write_text(source, encoding="utf-8")
        subprocess.run([
            dotnet, "add", str(root / "HooshyarOS.csproj"), "package", "Microsoft.Web.WebView2"
        ], cwd=root, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        subprocess.run([
            dotnet, "publish", str(root / "HooshyarOS.csproj"), "-c", "Release",
            "-o", str(root / "publish"), "--nologo"
        ], cwd=root, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, timeout=30 * 60)
        built = root / "publish" / "HooshyarOS.exe"
        if not built.exists():
            raise RuntimeError("HooshyarOS desktop shell was not produced")
        shutil.copy2(built, DESKTOP_SHELL)


def build_bootstrap() -> None:
    RELEASE_ROOT.mkdir(parents=True, exist_ok=True)
    node_exe = Path(shutil.which("node.exe") or "")
    if not node_exe.exists():
        raise RuntimeError("node.exe is required to build a self-contained Windows product")
    if not DESKTOP_SHELL.exists():
        raise RuntimeError("HooshyarOS desktop shell must be built before the installer")
    with tempfile.TemporaryDirectory(prefix="hooshyar-windows-") as temp:
        payload = Path(temp) / "payload"
        payload.mkdir()
        shutil.copy2(ROOT / "package.json", payload / "package.json")
        shutil.copytree(ROOT / "Backend", payload / "Backend")
        frontend = ROOT / "Frontend"
        if frontend.exists():
            shutil.copytree(frontend, payload / "Frontend")
        shutil.copy2(node_exe, payload / "node.exe")
        shutil.copy2(DESKTOP_SHELL, payload / "HooshyarOS.exe")
        with ZipFile(BOOTSTRAP, "w", ZIP_DEFLATED) as archive:
            for path in payload.rglob("*"):
                if path.is_file():
                    archive.write(path, path.relative_to(payload).as_posix())


def write_runtime_contract() -> None:
    INSTALLER_ROOT.mkdir(parents=True, exist_ok=True)
    (INSTALLER_ROOT / "commercial-runtime.js").write_text(STANDALONE_RUNTIME, encoding="utf-8")
    (INSTALLER_ROOT / "HooshyarOS-Windows-Bootstrap.zip").write_bytes(BOOTSTRAP.read_bytes())
    uninstall_contract = r'''$ErrorActionPreference = "Stop"
$InstallRoot = Join-Path $env:ProgramData "HooshyarOS"
$Shell = Join-Path $InstallRoot "HooshyarOS.exe"
$Desktop = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) "HooshyarOS.lnk"
$StartMenu = Join-Path ([Environment]::GetFolderPath('CommonPrograms')) "HooshyarOS.lnk"
$UninstallKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\HooshyarOS"
try {
  Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { try { if ($_.Path -and $_.Path -like "*HooshyarOS*\node.exe") { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } } catch {} }
  Get-Process HooshyarOS -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  if (Test-Path $Desktop) { Remove-Item $Desktop -Force -ErrorAction SilentlyContinue }
  if (Test-Path $StartMenu) { Remove-Item $StartMenu -Force -ErrorAction SilentlyContinue }
  if (Test-Path $UninstallKey) { Remove-Item $UninstallKey -Recurse -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 500
  if (Test-Path $InstallRoot) { Remove-Item $InstallRoot -Recurse -Force -ErrorAction Stop }
  if (Test-Path $InstallRoot) { exit 1 }
  if (Test-Path $env:ProgramData\HooshyarOS-uninstall.ps1) { Remove-Item $env:ProgramData\HooshyarOS-uninstall.ps1 -Force -ErrorAction SilentlyContinue }
  exit 0
} catch { exit 1 }
'''
    (INSTALLER_ROOT / "uninstall.ps1").write_text(uninstall_contract, encoding="utf-8")


def build_self_extracting_exe() -> None:
    dotnet = shutil.which("dotnet.exe") or shutil.which("dotnet")
    if not dotnet:
        raise RuntimeError("dotnet is unavailable on the Windows build runner")
    payload_b64 = base64.b64encode(BOOTSTRAP.read_bytes()).decode("ascii")
    runtime_b64 = base64.b64encode(STANDALONE_RUNTIME.encode("utf-8")).decode("ascii")
    uninstall_b64 = base64.b64encode((INSTALLER_ROOT / "uninstall.ps1").read_bytes()).decode("ascii")
    with tempfile.TemporaryDirectory(prefix="hooshyar-dotnet-installer-") as temp:
        root = Path(temp)
        project = root / "Installer.csproj"
        source = root / "Program.cs"
        project.write_text('''<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <SelfContained>true</SelfContained>
    <PublishSingleFile>true</PublishSingleFile>
    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
    <PublishTrimmed>false</PublishTrimmed>
    <InvariantGlobalization>true</InvariantGlobalization>
    <AssemblyName>HooshyarOS-Setup</AssemblyName>
  </PropertyGroup>
</Project>
''', encoding="utf-8")
        source.write_text(f'''using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Text;
using Microsoft.Win32;

internal static class Program
{{
    private const string BootstrapBase64 = "{payload_b64}";
    private const string RuntimeBase64 = "{runtime_b64}";
    private const string UninstallBase64 = "{uninstall_b64}";

    private static int Main()
    {{
        var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");
        var runtimeRoot = Path.Combine(installRoot, "runtime");
        var dataRoot = Path.Combine(installRoot, "data");
        var commonData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        var logPath = Path.Combine(commonData, "HooshyarOS-install.log");
        var externalUninstaller = Path.Combine(commonData, "HooshyarOS-uninstall.ps1");

        try
        {{
            Directory.CreateDirectory(runtimeRoot);
            Directory.CreateDirectory(dataRoot);
            File.WriteAllText(logPath, "START " + DateTimeOffset.UtcNow.ToString("O") + Environment.NewLine, Encoding.UTF8);

            var tempZip = Path.Combine(Path.GetTempPath(), "HooshyarOS-Windows-Bootstrap.zip");
            var tempExtract = Path.Combine(Path.GetTempPath(), "HooshyarOS-bootstrap-" + Guid.NewGuid().ToString("N"));
            File.WriteAllBytes(tempZip, Convert.FromBase64String(BootstrapBase64));
            Directory.CreateDirectory(tempExtract);
            ZipFile.ExtractToDirectory(tempZip, tempExtract);

            foreach (var file in Directory.EnumerateFiles(tempExtract, "*", SearchOption.AllDirectories))
            {{
                var relative = Path.GetRelativePath(tempExtract, file);
                var target = Path.Combine(runtimeRoot, relative);
                var parent = Path.GetDirectoryName(target);
                if (parent is not null) Directory.CreateDirectory(parent);
                File.Copy(file, target, true);
            }}

            var bundledShell = Path.Combine(runtimeRoot, "HooshyarOS.exe");
            var shellPath = Path.Combine(installRoot, "HooshyarOS.exe");
            if (File.Exists(bundledShell)) File.Move(bundledShell, shellPath, true);
            File.WriteAllBytes(Path.Combine(runtimeRoot, "commercial-runtime.js"), Convert.FromBase64String(RuntimeBase64));
            File.WriteAllBytes(externalUninstaller, Convert.FromBase64String(UninstallBase64));

            var marker = Path.Combine(installRoot, "HooshyarOS-install-complete.marker");
            File.WriteAllText(marker, "installed=" + DateTimeOffset.UtcNow.ToString("O"), Encoding.UTF8);

            var desktop = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory), "HooshyarOS.lnk");
            var startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms), "HooshyarOS.lnk");
            var shortcutScript = Path.Combine(Path.GetTempPath(), "HooshyarOS-shortcuts.ps1");
            var script = "$ws=New-Object -ComObject WScript.Shell; "
                       + "$desktop=$ws.CreateShortcut('" + desktop.Replace("'", "''") + "'); "
                       + "$desktop.TargetPath='" + shellPath.Replace("'", "''") + "'; "
                       + "$desktop.WorkingDirectory='" + installRoot.Replace("'", "''") + "'; "
                       + "$desktop.Save(); "
                       + "$start=$ws.CreateShortcut('" + startMenu.Replace("'", "''") + "'); "
                       + "$start.TargetPath='" + shellPath.Replace("'", "''") + "'; "
                       + "$start.WorkingDirectory='" + installRoot.Replace("'", "''") + "'; "
                       + "$start.Save();";
            File.WriteAllText(shortcutScript, script, Encoding.UTF8);

            var shortcutInfo = new ProcessStartInfo
            {{
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + shortcutScript + "\"",
                UseShellExecute = false,
                CreateNoWindow = true
            }};
            using (var ps = Process.Start(shortcutInfo))
            {{
                ps?.WaitForExit(15000);
            }}
            try {{ File.Delete(shortcutScript); }} catch {{ }}

            using (var key = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\HooshyarOS"))
            {{
                key?.SetValue("DisplayName", "Hooshyar.ai");
                key?.SetValue("DisplayVersion", "1.0.0");
                key?.SetValue("Publisher", "Hooshyar.ai");
                key?.SetValue("InstallLocation", installRoot);
                key?.SetValue("DisplayIcon", shellPath);
                key?.SetValue("UninstallString", "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \\"" + externalUninstaller + "\\"");
            }}

            File.AppendAllText(logPath, "COMPLETE " + DateTimeOffset.UtcNow.ToString("O") + Environment.NewLine, Encoding.UTF8);
            try {{ File.Delete(tempZip); Directory.Delete(tempExtract, true); }} catch {{ }}
            return 0;
        }}
        catch (Exception ex)
        {{
            try {{ File.AppendAllText(logPath, "ERROR " + ex + Environment.NewLine, Encoding.UTF8); }} catch {{ }}
            return 1;
        }}
    }}
}}
''', encoding="utf-8")

        env = os.environ.copy()
        env["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1"
        env["DOTNET_NOLOGO"] = "1"
        result = subprocess.run([
            dotnet, "publish", str(project), "-c", "Release",
            "-o", str(root / "publish"), "--nologo"
        ], cwd=root, env=env, text=True, encoding="utf-8", errors="replace",
           stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30 * 60, check=False)
        print(result.stdout, end="")
        if result.returncode != 0:
            raise RuntimeError(f"dotnet publish failed with exit code {result.returncode}")
        built = root / "publish" / "HooshyarOS-Setup.exe"
        if not built.exists() or built.stat().st_size < 1 * 1024 * 1024:
            raise RuntimeError("Self-contained Windows installer was not produced or is unexpectedly small")
        shutil.copy2(built, EXE)


def main() -> int:
    build_desktop_shell()
    build_bootstrap()
    write_runtime_contract()
    build_self_extracting_exe()
    print(f"WINDOWS_INSTALLER={EXE.relative_to(ROOT)}")
    print(f"WINDOWS_DESKTOP_SHELL={DESKTOP_SHELL.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
