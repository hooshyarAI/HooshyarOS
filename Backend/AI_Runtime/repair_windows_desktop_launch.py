from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "Backend" / "AI_Runtime" / "final_windows_installer_builder.py"

NEW_DESKTOP_CS = r'''using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    private const string ReadyMarker = "\"state\":\"ready\"";
    private static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");
    private static readonly string RuntimeRoot = Path.Combine(Root, "runtime");
    private static readonly string Node = Path.Combine(RuntimeRoot, "node.exe");
    private static readonly string Runtime = Path.Combine(RuntimeRoot, "commercial-runtime.js");
    private static readonly string LogPath = Path.Combine(Root, "desktop-shell.log");

    [STAThread]
    private static int Main()
    {
        try
        {
            Directory.CreateDirectory(Root);
            Log("START");

            if (!WaitUntilReady())
            {
                if (!File.Exists(Node) || !File.Exists(Runtime))
                {
                    Log("runtime-files-missing");
                    return 10;
                }

                var launch = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/d /c start \"HooshyarOS Runtime\" /b \"" + Node + "\" \"" + Runtime + "\"",
                    WorkingDirectory = RuntimeRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                var launcher = Process.Start(launch);
                Log("runtime-launcher-started=" + (launcher is not null));
                launcher?.WaitForExit(5000);

                if (!WaitUntilReady())
                {
                    Log("runtime-readiness-timeout");
                    return 11;
                }
                Log("runtime-ready");
            }
            else
            {
                Log("runtime-already-ready");
            }

            var edge = FindEdge();
            if (edge is not null)
            {
                var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HooshyarOS", "EdgeProfile");
                Directory.CreateDirectory(profile);
                var browser = Process.Start(new ProcessStartInfo
                {
                    FileName = edge,
                    Arguments = "--app=http://127.0.0.1:3000/ --new-window --no-first-run --no-default-browser-check --user-data-dir=\"" + profile + "\"",
                    UseShellExecute = true,
                });
                Log("edge-launched=" + (browser is not null));
                return browser is null ? 12 : 0;
            }

            var fallback = Process.Start(new ProcessStartInfo
            {
                FileName = "http://127.0.0.1:3000/",
                UseShellExecute = true,
            });
            Log("default-browser-launched=" + (fallback is not null));
            return fallback is null ? 13 : 0;
        }
        catch (Exception ex)
        {
            Log("ERROR " + ex);
            MessageBox.Show("HooshyarOS could not be started. Please repair or reinstall the application.", "Hooshyar.ai", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 14;
        }
    }

    private static bool WaitUntilReady()
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(700) };
        for (var attempt = 0; attempt < 40; attempt++)
        {
            try
            {
                var body = client.GetStringAsync("http://127.0.0.1:3000/api/dashboard").GetAwaiter().GetResult();
                if (body.Contains(ReadyMarker, StringComparison.Ordinal)) return true;
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
            Path.Combine(Environment.GetEnvironmentVariable("ProgramFiles") ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetEnvironmentVariable("ProgramFiles(x86)") ?? "", "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe"),
        };
        foreach (var candidate in candidates)
            if (File.Exists(candidate)) return candidate;
        return null;
    }

    private static void Log(string text)
    {
        try { File.AppendAllText(LogPath, DateTimeOffset.UtcNow.ToString("O") + " " + text + Environment.NewLine); } catch { }
    }
}
'''

text = BUILDER.read_text(encoding="utf-8")
start = text.index("DESKTOP_CS = r'''" )
end = text.index("\n\nDESKTOP_CSPROJ =", start)
patched = text[:start] + "DESKTOP_CS = r'''" + NEW_DESKTOP_CS + "'''" + text[end:]

if patched == text:
    raise SystemExit("no change made")

BUILDER.write_text(patched, encoding="utf-8")
print("PATCHED", BUILDER)
