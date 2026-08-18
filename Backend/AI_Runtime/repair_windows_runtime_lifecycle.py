from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "Backend" / "AI_Runtime" / "final_windows_installer_builder.py"

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
    private static int Main(string[] args)
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
                    MessageBox.Show("HooshyarOS runtime is incomplete. Please repair or reinstall the application.", "Hooshyar.ai", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 10;
                }

                var launch = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/d /c start \"HooshyarOS Runtime\" /b \"" + Node + "\" \"" + Runtime + "\"",
                    WorkingDirectory = RuntimeRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                };

                using var launcher = Process.Start(launch);
                if (launcher is null)
                {
                    Log("runtime-launcher-start-failed");
                    MessageBox.Show("HooshyarOS runtime could not be started. Please repair or reinstall the application.", "Hooshyar.ai", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return 11;
                }

                launcher.WaitForExit(5000);
                Log("runtime-launch-requested node=" + Node);

                if (!WaitUntilReady())
                {
                    Log("runtime-readiness-timeout");
                    MessageBox.Show("HooshyarOS runtime could not be started. Please repair or reinstall the application.", "Hooshyar.ai", MessageBoxButtons.OK, MessageBoxIcon.Error);
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
            Process? browser = null;
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

            return browser is null ? 13 : 0;
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


def replace_desktop_block(text: str) -> str:
    start = text.find("DESKTOP_CS = r'''")
    if start < 0:
        raise RuntimeError("DESKTOP_CS start marker not found")
    end = text.find("DESKTOP_CSPROJ =", start)
    if end < 0:
        raise RuntimeError("DESKTOP_CSPROJ marker not found")
    return text[:start] + "DESKTOP_CS = r'''" + DESKTOP_CS + "'''\n\n" + text[end:]


def patch_builder() -> None:
    current = BUILDER.read_text(encoding="utf-8")
    updated = replace_desktop_block(current)
    if updated == current:
        raise RuntimeError("desktop shell contract was not changed")
    BUILDER.write_text(updated, encoding="utf-8")


def verify_builder() -> None:
    text = BUILDER.read_text(encoding="utf-8")
    required = (
        'FileName = "cmd.exe"',
        'Arguments = "/d /c start \\"HooshyarOS Runtime\\" /b',
        "runtime-launch-requested node=",
        "runtime-ready",
    )
    missing = [item for item in required if item not in text]
    if missing:
        raise RuntimeError("runtime detachment contract incomplete: " + ", ".join(missing))
    forbidden = ("runtimeProcess.Kill(true)", "browser.WaitForExit();")
    present = [item for item in forbidden if item in text]
    if present:
        raise RuntimeError("runtime detachment contract still contains: " + ", ".join(present))


if __name__ == "__main__":
    patch_builder()
    verify_builder()
    print("PATCHED Windows runtime detachment contract")
