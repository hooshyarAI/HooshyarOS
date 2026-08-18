from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "Backend" / "AI_Runtime" / "final_windows_installer_builder.py"
TEST = ROOT / "Backend" / "HBOS" / "test" / "WindowsProductInstallerContract.test.ts"

DESKTOP_CS = r'''using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading;
using System.Windows.Forms;

internal static class Program
{
    private const string ReadyMarker = "\"state\":\"ready\""; // "state":"ready"
    private static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HooshyarOS");
    private static readonly string RuntimeRoot = Path.Combine(Root, "runtime");
    private static readonly string Node = Path.Combine(RuntimeRoot, "node.exe");
    private static readonly string Runtime = Path.Combine(RuntimeRoot, "commercial-runtime.js");
    private static readonly string LogPath = Path.Combine(Root, "desktop-shell.log");

    [STAThread]
    private static int Main()
    {
        Process? runtimeProcess = null;
        Process? browser = null;
        try
        {
            Directory.CreateDirectory(Root);
            Log("START");

            if (!WaitUntilReady())
            {
                if (!File.Exists(Node) || !File.Exists(Runtime))
                {
                    Log("runtime-files-missing");
                    MessageBox.Show("HooshyarOS runtime is incomplete. Please repair or reinstall the application.", "Hooshyar.ai", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 10;
                }

                runtimeProcess = Process.Start(new ProcessStartInfo
                {
                    FileName = Node,
                    Arguments = "\"" + Runtime + "\"",
                    WorkingDirectory = RuntimeRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                });
                if (runtimeProcess is null)
                {
                    Log("runtime-start-failed");
                    return 11;
                }
                Log("runtime-started pid=" + runtimeProcess.Id);

                if (!WaitUntilReady())
                {
                    Log("runtime-readiness-timeout");
                    return 12;
                }
                Log("runtime-ready");
            }
            else
            {
                Log("runtime-already-ready");
            }

            var url = "http://127.0.0.1:3000/";
            var edge = FindEdge();
            if (edge is not null)
            {
                var profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HooshyarOS", "EdgeProfile");
                Directory.CreateDirectory(profile);
                browser = Process.Start(new ProcessStartInfo
                {
                    FileName = edge,
                    Arguments = "--app=" + url + " --new-window --no-first-run --no-default-browser-check --user-data-dir=\"" + profile + "\"",
                    UseShellExecute = true,
                });
                Log("edge-launched=" + (browser is not null));
            }
            else
            {
                browser = Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
                Log("default-browser-launched=" + (browser is not null));
            }

            if (browser is null)
                return 13;

            // Keep this shell alive for the whole desktop session. The Node runtime
            // is intentionally owned by this process while the browser is open.
            browser.WaitForExit();
            Log("browser-exited");
            return 0;
        }
        catch (Exception ex)
        {
            Log("ERROR " + ex);
            MessageBox.Show("HooshyarOS could not be started. Please repair or reinstall the application.", "Hooshyar.ai", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 14;
        }
        finally
        {
            try
            {
                if (runtimeProcess is { HasExited: false })
                    runtimeProcess.Kill(true);
            }
            catch { }
            Log("STOP");
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

s = BUILDER.read_text(encoding="utf-8")
pattern = r"DESKTOP_CS = r''' .*? '''\n\nDESKTOP_CSPROJ ="
replacement = "DESKTOP_CS = r'''" + DESKTOP_CS + "'''\n\nDESKTOP_CSPROJ ="
new_s, count = re.subn(pattern, replacement, s, count=1, flags=re.S)
if count != 1:
    raise SystemExit("DESKTOP_CS block not found")
BUILDER.write_text(new_s, encoding="utf-8")

# Keep the test aligned with the real desktop-session contract.
t = TEST.read_text(encoding="utf-8")
t = t.replace('    it("detaches the installed Node runtime from the desktop shell lifecycle", () => {\n        expect(finalInstallerBuilder).toContain(\'FileName = "cmd.exe"\');\n        expect(finalInstallerBuilder).toContain(\'Arguments = "/d /c start \\\\\"HooshyarOS Runtime\\\\\" /b\');\n        expect(finalInstallerBuilder).not.toContain("runtime.Kill(true)");\n    });', '''    it("keeps the runtime alive for the desktop session", () => {
        expect(finalInstallerBuilder).toContain("browser.WaitForExit();");
        expect(finalInstallerBuilder).toContain("runtimeProcess.Kill(true)");
        expect(finalInstallerBuilder).toContain("runtime-started pid=");
        expect(finalInstallerBuilder).toContain("browser-exited");
        expect(finalInstallerBuilder).not.toContain('FileName = "cmd.exe"');
    });''')
TEST.write_text(t, encoding="utf-8")
print("PATCHED Windows desktop runtime lifecycle")
