"""Canonical Windows installer builder for HooshyarOS."""
from __future__ import annotations

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

# Existing file body up to the publish helper is intentionally retained.
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

DESKTOP_CS = r'''using System;
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
    private readonly WebView2 web = new() { Dock = DockStyle.Fill };
    private Process? runtime;

    public MainForm()
    {
        Text = "Hooshyar.ai";
        Width = 1400;
        Height = 900;
        MinimumSize = new System.Drawing.Size(1024, 700);
        StartPosition = FormStartPosition.CenterScreen;
        Controls.Add(web);
        Shown += async (_, _) => await StartAsync();
        FormClosing += (_, _) => StopRuntime();
    }

    private async System.Threading.Tasks.Task StartAsync()
    {
        var root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");
        var runtimeRoot = Path.Combine(root, "runtime");
        var node = Path.Combine(runtimeRoot, "node.exe");
        var app = Path.Combine(runtimeRoot, "commercial-runtime.js");
        if (!Ready())
        {
            if (!File.Exists(node) || !File.Exists(app))
            {
                MessageBox.Show("HooshyarOS runtime is incomplete. Please repair or reinstall the application.", "Hooshyar.ai", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            runtime = Process.Start(new ProcessStartInfo
            {
                FileName = node,
                Arguments = "\"" + app + "\"",
                WorkingDirectory = runtimeRoot,
                UseShellExecute = false,
                CreateNoWindow = true
            });
        }
        await web.EnsureCoreWebView2Async();
        web.Source = new Uri("http://127.0.0.1:3000/");
    }

    private static bool Ready()
    {
        try
        {
            using var client = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromMilliseconds(700) };
            var response = client.GetAsync("http://127.0.0.1:3000/api/dashboard").GetAwaiter().GetResult();
            return response.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    private void StopRuntime()
    {
        try { if (runtime is { HasExited: false }) runtime.Kill(true); } catch { }
    }
}
'''

DESKTOP_CSPROJ = r'''<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <SelfContained>true</SelfContained>
    <PublishSingleFile>true</PublishSingleFile>
    <UseAppHost>true</UseAppHost>
    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
    <PublishTrimmed>false</PublishTrimmed>
    <InvariantGlobalization>true</InvariantGlobalization>
    <AssemblyName>HooshyarOS</AssemblyName>
  </PropertyGroup>
</Project>
'''

UNINSTALL_PS = r'''$ErrorActionPreference = "Stop"
$InstallRoot = Join-Path $env:ProgramData "HooshyarOS"
$Desktop = Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) "HooshyarOS.lnk"
$StartMenu = Join-Path ([Environment]::GetFolderPath('CommonPrograms')) "HooshyarOS.lnk"
$UninstallKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\HooshyarOS"
try {
  Get-Process HooshyarOS -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Get-Process node -ErrorAction SilentlyContinue | ForEach-Object {
    try { if ($_.Path -and $_.Path -like "*\ProgramData\HooshyarOS\runtime\node.exe") { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } } catch {}
  }
  Remove-Item $Desktop -Force -ErrorAction SilentlyContinue
  Remove-Item $StartMenu -Force -ErrorAction SilentlyContinue
  Remove-Item $UninstallKey -Recurse -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 500
  Remove-Item $InstallRoot -Recurse -Force -ErrorAction Stop
  if (Test-Path $InstallRoot) { exit 1 }
  Remove-Item (Join-Path $env:ProgramData "HooshyarOS-uninstall.ps1") -Force -ErrorAction SilentlyContinue
  exit 0
} catch { exit 1 }
'''

INSTALLER_CS = r'''using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Text;
using Microsoft.Win32;

internal static class Program
{
    private static Stream OpenResource(string name)
    {
        return Assembly.GetExecutingAssembly().GetManifestResourceStream(name)
            ?? throw new InvalidOperationException("Missing embedded installer resource: " + name);
    }

    private static void CopyResource(string name, string destination)
    {
        var parent = Path.GetDirectoryName(destination);
        if (parent is not null) Directory.CreateDirectory(parent);
        using var input = OpenResource(name);
        using var output = File.Create(destination);
        input.CopyTo(output);
    }

    private static int Main()
    {
        var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");
        var runtimeRoot = Path.Combine(installRoot, "runtime");
        var commonData = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
        var logPath = Path.Combine(commonData, "HooshyarOS-install.log");
        var externalUninstaller = Path.Combine(commonData, "HooshyarOS-uninstall.ps1");

        try
        {
            Directory.CreateDirectory(runtimeRoot);
            File.WriteAllText(logPath, "START " + DateTimeOffset.UtcNow.ToString("O") + Environment.NewLine, Encoding.UTF8);

            var tempExtract = Path.Combine(Path.GetTempPath(), "HooshyarOS-bootstrap-" + Guid.NewGuid().ToString("N"));
            var tempZip = Path.Combine(Path.GetTempPath(), "HooshyarOS-bootstrap.zip");
            CopyResource("HooshyarOS.Bootstrap", tempZip);
            System.IO.Compression.ZipFile.ExtractToDirectory(tempZip, tempExtract);

            foreach (var file in Directory.EnumerateFiles(tempExtract, "*", SearchOption.AllDirectories))
            {
                var relative = Path.GetRelativePath(tempExtract, file);
                var target = Path.Combine(runtimeRoot, relative);
                var parent = Path.GetDirectoryName(target);
                if (parent is not null) Directory.CreateDirectory(parent);
                File.Copy(file, target, true);
            }

            var bundledShell = Path.Combine(runtimeRoot, "HooshyarOS.exe");
            var shellPath = Path.Combine(installRoot, "HooshyarOS.exe");
            if (File.Exists(bundledShell)) File.Move(bundledShell, shellPath, true);
            CopyResource("HooshyarOS.Runtime", Path.Combine(runtimeRoot, "commercial-runtime.js"));
            CopyResource("HooshyarOS.Uninstall", externalUninstaller);
            File.WriteAllText(Path.Combine(installRoot, "HooshyarOS-install-complete.marker"), "installed=" + DateTimeOffset.UtcNow.ToString("O"), Encoding.UTF8);

            var desktop = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory), "HooshyarOS.lnk");
            var startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonPrograms), "HooshyarOS.lnk");
            var shortcutScript = Path.Combine(Path.GetTempPath(), "HooshyarOS-shortcuts.ps1");
            var psScript = "$ws=New-Object -ComObject WScript.Shell; "
                         + "$d=$ws.CreateShortcut('" + desktop.Replace("'", "''") + "'); "
                         + "$d.TargetPath='" + shellPath.Replace("'", "''") + "'; "
                         + "$d.WorkingDirectory='" + installRoot.Replace("'", "''") + "'; $d.Save(); "
                         + "$s=$ws.CreateShortcut('" + startMenu.Replace("'", "''") + "'); "
                         + "$s.TargetPath='" + shellPath.Replace("'", "''") + "'; "
                         + "$s.WorkingDirectory='" + installRoot.Replace("'", "''") + "'; $s.Save();";
            File.WriteAllText(shortcutScript, psScript, Encoding.UTF8);
            var shortcutInfo = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + shortcutScript + "\"",
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using (var process = Process.Start(shortcutInfo)) { process?.WaitForExit(15000); }
            try { File.Delete(shortcutScript); } catch { }

            using (var key = Registry.LocalMachine.CreateSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\HooshyarOS"))
            {
                key?.SetValue("DisplayName", "Hooshyar.ai");
                key?.SetValue("DisplayVersion", "1.0.0");
                key?.SetValue("Publisher", "Hooshyar.ai");
                key?.SetValue("InstallLocation", installRoot);
                key?.SetValue("DisplayIcon", shellPath);
                key?.SetValue("UninstallString", "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"" + externalUninstaller + "\"");
            }

            File.AppendAllText(logPath, "COMPLETE " + DateTimeOffset.UtcNow.ToString("O") + Environment.NewLine, Encoding.UTF8);
            try { File.Delete(tempZip); Directory.Delete(tempExtract, true); } catch { }
            return 0;
        }
        catch (Exception ex)
        {
            try { File.AppendAllText(logPath, "ERROR " + ex + Environment.NewLine, Encoding.UTF8); } catch { }
            return 1;
        }
    }
}
'''


def _find_published_exe(output: Path, assembly_name: str) -> Path:
    exact = output / f"{assembly_name}.exe"
    if exact.is_file():
        return exact
    candidates = sorted(output.glob("*.exe"), key=lambda p: p.stat().st_size, reverse=True)
    if len(candidates) == 1:
        return candidates[0]
    names = ", ".join(p.name for p in candidates) or "<none>"
    raise RuntimeError(f"No unambiguous Windows executable produced for {assembly_name}; publish output EXEs: {names}")


def publish(dotnet: str, project_text: str, source_text: str, assembly_name: str, temp_prefix: str, extra_files: dict[str, bytes] | None = None) -> Path:
    with tempfile.TemporaryDirectory(prefix=temp_prefix) as temp:
        root = Path(temp)
        project = root / f"{assembly_name}.csproj"
        source = root / "Program.cs"
        output = root / "publish"
        project.write_text(project_text, encoding="utf-8")
        source.write_text(source_text, encoding="utf-8")
        if extra_files:
            for name, data in extra_files.items():
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(data)
        env = os.environ.copy()
        env["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1"
        env["DOTNET_NOLOGO"] = "1"
        result = subprocess.run(
            [dotnet, "publish", str(project), "-c", "Release", "-r", "win-x64", "--self-contained", "true", "-p:UseAppHost=true", "-p:PublishSingleFile=true", "-o", str(output), "--nologo"],
            cwd=root, env=env, text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30 * 60, check=False,
        )
        print(result.stdout, end="")
        if result.returncode != 0:
            raise RuntimeError(f"dotnet publish failed for {assembly_name} with exit code {result.returncode}")
        built = _find_published_exe(output, assembly_name)
        RELEASE_ROOT.mkdir(parents=True, exist_ok=True)
        persisted = RELEASE_ROOT / f".{assembly_name}.build.exe"
        shutil.copy2(built, persisted)
        print(f"PUBLISHED_EXE={built.name} SIZE={persisted.stat().st_size}")
        return persisted


def build_desktop_shell(dotnet: str) -> None:
    with tempfile.TemporaryDirectory(prefix="hooshyar-shell-package-") as temp:
        root = Path(temp)
        project = root / "HooshyarOS.csproj"
        project.write_text(DESKTOP_CSPROJ, encoding="utf-8")
        result = subprocess.run([dotnet, "add", str(project), "package", "Microsoft.Web.WebView2"], cwd=root, text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=10 * 60, check=False)
        print(result.stdout, end="")
        if result.returncode != 0:
            raise RuntimeError("Unable to restore Microsoft.Web.WebView2")
        (root / "Program.cs").write_text(DESKTOP_CS, encoding="utf-8")
        env = os.environ.copy()
        env["DOTNET_CLI_TELEMETRY_OPTOUT"] = "1"
        env["DOTNET_NOLOGO"] = "1"
        out = root / "publish"
        result = subprocess.run([dotnet, "publish", str(project), "-c", "Release", "-r", "win-x64", "--self-contained", "true", "-p:UseAppHost=true", "-p:PublishSingleFile=true", "-o", str(out), "--nologo"], cwd=root, env=env, text=True, encoding="utf-8", errors="replace", stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30 * 60, check=False)
        print(result.stdout, end="")
        if result.returncode != 0:
            raise RuntimeError("HooshyarOS desktop shell publish failed")
        built = _find_published_exe(out, "HooshyarOS")
        RELEASE_ROOT.mkdir(parents=True, exist_ok=True)
        shutil.copy2(built, DESKTOP_SHELL)
        if DESKTOP_SHELL.stat().st_size < 1 * 1024 * 1024:
            raise RuntimeError("HooshyarOS desktop shell is unexpectedly small")


def build_bootstrap() -> None:
    RELEASE_ROOT.mkdir(parents=True, exist_ok=True)
    node = shutil.which("node.exe") or shutil.which("node")
    if not node:
        raise RuntimeError("node.exe is required")
    node_exe = Path(node)
    if not DESKTOP_SHELL.exists():
        raise RuntimeError("Desktop shell must be built before bootstrap")
    with tempfile.TemporaryDirectory(prefix="hooshyar-windows-payload-") as temp:
        payload = Path(temp) / "payload"
        payload.mkdir()
        shutil.copy2(ROOT / "package.json", payload / "package.json")
        shutil.copytree(ROOT / "Backend", payload / "Backend")
        frontend = ROOT / "Frontend"
        if frontend.exists(): shutil.copytree(frontend, payload / "Frontend")
        shutil.copy2(node_exe, payload / "node.exe")
        shutil.copy2(DESKTOP_SHELL, payload / "HooshyarOS.exe")
        with ZipFile(BOOTSTRAP, "w", ZIP_DEFLATED) as archive:
            for path in payload.rglob("*"):
                if path.is_file(): archive.write(path, path.relative_to(payload).as_posix())


def build_installer(dotnet: str) -> None:
    RELEASE_ROOT.mkdir(parents=True, exist_ok=True)
    INSTALLER_ROOT.mkdir(parents=True, exist_ok=True)
    (INSTALLER_ROOT / "uninstall.ps1").write_text(UNINSTALL_PS, encoding="utf-8")
    project = r'''<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <SelfContained>true</SelfContained>
    <PublishSingleFile>true</PublishSingleFile>
    <UseAppHost>true</UseAppHost>
    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
    <IncludeAllContentForSelfExtract>true</IncludeAllContentForSelfExtract>
    <PublishTrimmed>false</PublishTrimmed>
    <InvariantGlobalization>true</InvariantGlobalization>
    <AssemblyName>HooshyarOS-Setup</AssemblyName>
  </PropertyGroup>
  <ItemGroup>
    <EmbeddedResource Include="bootstrap.bin"><LogicalName>HooshyarOS.Bootstrap</LogicalName></EmbeddedResource>
    <EmbeddedResource Include="runtime.bin"><LogicalName>HooshyarOS.Runtime</LogicalName></EmbeddedResource>
    <EmbeddedResource Include="uninstall.bin"><LogicalName>HooshyarOS.Uninstall</LogicalName></EmbeddedResource>
  </ItemGroup>
</Project>
'''
    extra = {
        "bootstrap.bin": BOOTSTRAP.read_bytes(),
        "runtime.bin": STANDALONE_RUNTIME.encode("utf-8"),
        "uninstall.bin": UNINSTALL_PS.encode("utf-8"),
    }
    built = publish(dotnet, project, INSTALLER_CS, "HooshyarOS-Setup", "hooshyar-installer-", extra_files=extra)
    if built.stat().st_size < 1 * 1024 * 1024:
        raise RuntimeError("Installer is unexpectedly small")
    shutil.copy2(built, EXE)
    print(f"INSTALLER_EXE_SIZE={EXE.stat().st_size}")


def main() -> int:
    dotnet = shutil.which("dotnet.exe") or shutil.which("dotnet")
    if not dotnet:
        raise RuntimeError("dotnet is unavailable")
    build_desktop_shell(dotnet)
    build_bootstrap()
    build_installer(dotnet)
    print(f"WINDOWS_INSTALLER={EXE.relative_to(ROOT)}")
    print(f"WINDOWS_DESKTOP_SHELL={DESKTOP_SHELL.relative_to(ROOT)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
