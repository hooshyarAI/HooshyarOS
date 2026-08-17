from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "dist" / "productization" / "windows"
SHELL_EXE = OUT / "HooshyarOS.exe"

SOURCE = r'''
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
        var form = new MainForm();
        Application.Run(form);
    }
}

internal sealed class MainForm : Form
{
    private readonly WebView2 _web;
    private Process? _runtime;

    public MainForm()
    {
        Text = "هوشیار.ai";
        Width = 1400;
        Height = 900;
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new System.Drawing.Size(1024, 700);
        _web = new WebView2 { Dock = DockStyle.Fill };
        Controls.Add(_web);
        Shown += async (_, _) => await StartAsync();
        FormClosing += (_, _) => StopRuntime();
    }

    private async System.Threading.Tasks.Task StartAsync()
    {
        var installRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");
        var runtimeRoot = Path.Combine(installRoot, "runtime");
        var node = Path.Combine(runtimeRoot, "node.exe");
        var script = Path.Combine(runtimeRoot, "commercial-runtime.js");
        if (File.Exists(node) && File.Exists(script))
        {
            if (!IsReady())
            {
                _runtime = Process.Start(new ProcessStartInfo(node, $"\"{script}\"")
                {
                    WorkingDirectory = runtimeRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    Environment = { ["PORT"] = "3000" }
                });
            }
        }
        await _web.EnsureCoreWebView2Async();
        _web.Source = new Uri("http://127.0.0.1:3000/");
    }

    private static bool IsReady()
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
        try
        {
            if (_runtime is { HasExited: false }) _runtime.Kill(entireProcessTree: true);
        }
        catch { }
    }
}
'''

CSPROJ = '''<Project Sdk="Microsoft.NET.Sdk">
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


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    dotnet = shutil.which("dotnet.exe") or shutil.which("dotnet")
    if not dotnet:
        raise RuntimeError("dotnet is unavailable")
    with tempfile.TemporaryDirectory(prefix="hooshyar-shell-") as temp:
        root = Path(temp)
        (root / "HooshyarOS.csproj").write_text(CSPROJ, encoding="utf-8")
        (root / "Program.cs").write_text(SOURCE, encoding="utf-8")
        subprocess.run([dotnet, "add", str(root / "HooshyarOS.csproj"), "package", "Microsoft.Web.WebView2"], cwd=root, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        subprocess.run([dotnet, "publish", str(root / "HooshyarOS.csproj"), "-c", "Release", "-o", str(root / "publish"), "--nologo"], cwd=root, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=30 * 60)
        built = root / "publish" / "HooshyarOS.exe"
        if not built.exists():
            raise RuntimeError("HooshyarOS desktop shell was not produced")
        shutil.copy2(built, SHELL_EXE)
    print(f"WINDOWS_DESKTOP_SHELL={SHELL_EXE.relative_to(ROOT)}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
