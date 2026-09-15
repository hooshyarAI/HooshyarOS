from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist" / "productization" / "windows"

# The packaged commercial runtime is TypeScript executed by `tsx`. Its third
# party imports are the declared production dependencies of package.json plus
# the `tsx` executor itself; everything else is pulled in transitively.
RUNTIME_DEPENDENCY_ROOTS = ("tsx",)
TYPE_ONLY_PACKAGE_PREFIX = "@types/"
ICON_ASSET = ROOT / "installer" / "hooshyaros.ico"

# Named runtime packages that the installed commercial runtime must be able to
# resolve. This is a deliberate minimum contract on top of the full closure.
REQUIRED_RUNTIME_PACKAGES = ("exceljs-hardened", "mammoth", "pdf-parse", "better-sqlite3")


def _should_skip_file(path: Path) -> bool:
    name = path.name
    return (path.is_dir() and name in {"__pycache__", "node_modules"}) or name.endswith((".pyc", ".test", ".spec")) or name == ".git"


def _validate_windows_node_executable(node_exe: Path) -> None:
    if node_exe.read_bytes()[:2] != b"MZ":
        raise RuntimeError(f"Windows packaging requires a Windows PE node.exe; got: {node_exe}")


def _validate_windows_payload(payload: Path) -> None:
    required = [
        payload / "node-runtime" / "node.exe",
        payload / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "start-commercial-runtime.ts",
        payload / "node_modules" / "tsx" / "dist" / "cli.mjs",
        payload / "web" / "index.html",
        payload / "web" / "app.js",
        payload / "web" / "styles.css",
        payload / "web" / "manifest.webmanifest",
        payload / "web" / "sw.js",
        payload / "launch-hooshyar.vbs",
        payload / "launch-hooshyar.ps1",
        payload / "install-health.ps1",
        payload / "hooshyaros.ico",
    ]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        raise RuntimeError(f"customer payload incomplete: {missing}")
    if any(p.suffix == ".pyc" or "__pycache__" in p.parts for p in payload.rglob("*")):
        raise RuntimeError("development artifacts leaked into customer payload")
    _validate_windows_node_executable(payload / "node-runtime" / "node.exe")
    _validate_packaged_runtime(payload)


def _resolve_package_dir(name: str, from_dir: Path, package_root: Path) -> Path | None:
    """Resolve an npm package exactly like Node.js does, walking node_modules upward."""
    current = from_dir
    while True:
        candidate = current / "node_modules" / name
        if (candidate / "package.json").exists():
            return candidate
        parent = current.parent
        if parent == current or current == package_root:
            return None
        current = parent


def _production_dependency_roots() -> list[str]:
    """Authoritative runtime dependency roots: package.json dependencies + the tsx executor."""
    roots = set(RUNTIME_DEPENDENCY_ROOTS)
    manifest = ROOT / "package.json"
    try:
        package = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        package = {}
    roots.update(str(name) for name in package.get("dependencies", {}))
    return sorted(roots)


def _runtime_dependency_names() -> list[str]:
    """Return repository-relative paths of the complete runtime npm dependency closure.

    Resolution starts from the declared production dependencies and `tsx`, then
    follows each package's own `dependencies`/`optionalDependencies` using real
    Node resolution. Nested (non-hoisted) versions are preserved at their exact
    relative location so the packaged tree resolves identically to the build.
    """
    resolved: dict[Path, Path] = {}
    pending: list[tuple[str, Path]] = [(name, ROOT) for name in _production_dependency_roots()]
    while pending:
        name, from_dir = pending.pop()
        if name.startswith(TYPE_ONLY_PACKAGE_PREFIX):
            continue
        package_dir = _resolve_package_dir(name, from_dir, ROOT)
        if package_dir is None:
            continue
        relative = package_dir.relative_to(ROOT)
        if relative in resolved:
            continue
        resolved[relative] = package_dir
        try:
            package = json.loads((package_dir / "package.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        dependencies = {
            **package.get("dependencies", {}),
            **package.get("optionalDependencies", {}),
        }
        pending.extend((dependency, package_dir) for dependency in dependencies)
    return [relative.as_posix() for relative in sorted(resolved)]


def _copy_runtime_node_modules(source: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for name in _runtime_dependency_names():
        src = source / name
        if src.exists():
            shutil.copytree(src, destination / name, dirs_exist_ok=True)


def _free_local_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _terminate_process_tree(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        process.terminate()
    try:
        process.wait(timeout=15)
    except subprocess.TimeoutExpired:
        process.kill()


def _validate_packaged_runtime(payload: Path) -> None:
    """Prove the packaged payload can really resolve and execute its runtime.

    This is behavioral, not file-existence, validation: the bundled node.exe
    must resolve the required npm packages from the runtime import context and
    the real commercial startup path must reach `/health` on a live port.
    """
    node = payload / "node-runtime" / "node.exe"
    tsx = payload / "node_modules" / "tsx" / "dist" / "cli.mjs"
    entry = payload / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "start-commercial-runtime.ts"
    context = payload / "Backend" / "HBOS"

    resolution_script = ";".join(
        f"require.resolve({json.dumps(name)})" for name in REQUIRED_RUNTIME_PACKAGES
    )
    resolution = subprocess.run(
        [str(node), "-e", resolution_script],
        cwd=str(context),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
        check=False,
    )
    if resolution.returncode != 0:
        raise RuntimeError(
            "packaged runtime cannot resolve required npm dependencies from "
            f"{context}: {resolution.stderr.strip()}"
        )

    port = _free_local_port()
    workdir = Path(tempfile.mkdtemp(prefix="hooshyar-payload-validation-"))
    log = workdir / "runtime.log"
    env = {
        **os.environ,
        "HOOSHYAR_HOST": "127.0.0.1",
        "HOOSHYAR_PORT": str(port),
        "HOOSHYAR_DB_PATH": str(workdir / "validation.sqlite"),
    }
    with log.open("w", encoding="utf-8", errors="replace") as handle:
        process = subprocess.Popen(
            [str(node), str(tsx), str(entry)],
            cwd=str(payload),
            env=env,
            stdout=handle,
            stderr=subprocess.STDOUT,
        )
    try:
        deadline = time.monotonic() + 90
        healthy = False
        while time.monotonic() < deadline:
            if process.poll() is not None:
                break
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2) as response:
                    body = json.loads(response.read().decode("utf-8"))
                if body.get("status") == "ok":
                    healthy = True
                    break
            except Exception:
                time.sleep(0.5)
        if not healthy:
            details = log.read_text(encoding="utf-8", errors="replace")[-4000:]
            raise RuntimeError(
                f"packaged commercial runtime did not become healthy on port {port}. Runtime log:\n{details}"
            )
    finally:
        _terminate_process_tree(process)
        shutil.rmtree(workdir, ignore_errors=True)


def _write_launch_surface(payload: Path) -> None:
    # launch-hooshyar.ps1 owns the real startup contract: start the bundled
    # runtime, wait for an actual /health success, only then open the browser,
    # and surface an actionable failure (never a silent broken page).
    (payload / "launch-hooshyar.ps1").write_text(
        "$ErrorActionPreference = 'Stop'\r\n"
        "$here = Split-Path -Parent $MyInvocation.MyCommand.Path\r\n"
        "$logDir = Join-Path $here 'logs'\r\n"
        "New-Item -ItemType Directory -Force -Path $logDir | Out-Null\r\n"
        "$log = Join-Path $logDir 'hooshyar-runtime.log'\r\n"
        "$hostName = '127.0.0.1'\r\n"
        "$port = 4173\r\n"
        "$env:HOOSHYAR_HOST = $hostName\r\n"
        "$env:HOOSHYAR_PORT = \"$port\"\r\n"
        "$node = Join-Path $here 'node-runtime\\node.exe'\r\n"
        "$tsx = Join-Path $here 'node_modules\\tsx\\dist\\cli.mjs'\r\n"
        "$entry = Join-Path $here 'Backend\\HBOS\\Autonomous\\Runtime\\start-commercial-runtime.ts'\r\n"
        "$url = ('http://{0}:{1}/' -f $hostName, $port)\r\n"
        "$healthUrl = ('http://{0}:{1}/health' -f $hostName, $port)\r\n"
        "$process = $null\r\n"
        "try {\r\n"
        "  $process = Start-Process -FilePath $node -ArgumentList @($tsx, $entry) -WorkingDirectory $here -PassThru -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError ($log + '.err')\r\n"
        "  if (-not $process) { throw 'Could not start the HooshyarOS runtime process.' }\r\n"
        "  $deadline = (Get-Date).AddSeconds(60)\r\n"
        "  $healthy = $false\r\n"
        "  do {\r\n"
        "    if ($process.HasExited) { throw ('The HooshyarOS runtime exited before becoming healthy (exit code ' + $process.ExitCode + ').') }\r\n"
        "    try {\r\n"
        "      $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2\r\n"
        "      if ($response -and $response.status -eq 'ok') { $healthy = $true; break }\r\n"
        "    } catch { Start-Sleep -Milliseconds 500 }\r\n"
        "  } while ((Get-Date) -lt $deadline)\r\n"
        "  if (-not $healthy) { throw 'Timed out waiting for the HooshyarOS runtime health check.' }\r\n"
        "  Start-Process $url\r\n"
        "  exit 0\r\n"
        "} catch {\r\n"
        "  if ($process -and -not $process.HasExited) { & taskkill /PID $process.Id /T /F | Out-Null }\r\n"
        "  $message = \"HooshyarOS could not start.`r`n`r`n\" + $_.Exception.Message + \"`r`n`r`nStartup log:`r`n\" + $log\r\n"
        "  try { (New-Object -ComObject WScript.Shell).Popup($message, 0, 'HooshyarOS startup failed', 16) | Out-Null } catch { Write-Host $message }\r\n"
        "  exit 1\r\n"
        "}\r\n",
        encoding="utf-8",
    )
    (payload / "launch-hooshyar.vbs").write_text(
        'Option Explicit\r\n'
        'Dim shell, fso, here, script, command, code\r\n'
        'Set shell = CreateObject("WScript.Shell")\r\n'
        'Set fso = CreateObject("Scripting.FileSystemObject")\r\n'
        'here = fso.GetParentFolderName(WScript.ScriptFullName)\r\n'
        'shell.CurrentDirectory = here\r\n'
        'script = here & "\\launch-hooshyar.ps1"\r\n'
        'command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & script & """"\r\n'
        'code = shell.Run(command, 0, True)\r\n'
        'If code <> 0 Then WScript.Quit code\r\n',
        encoding="utf-8",
    )
    (payload / "launch-hooshyar.cmd").write_text(
        "@echo off\r\n"
        "setlocal\r\n"
        "cd /d \"%~dp0\"\r\n"
        "set HOOSHYAR_HOST=127.0.0.1\r\n"
        "set HOOSHYAR_PORT=4173\r\n"
        "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%~dp0launch-hooshyar.ps1\"\r\n",
        encoding="utf-8",
    )
    (payload / "install-health.ps1").write_text(
        "$ErrorActionPreference='Stop'\r\n"
        "$here = Split-Path -Parent $MyInvocation.MyCommand.Path\r\n"
        "$env:HOOSHYAR_HOST='127.0.0.1'\r\n"
        "$env:HOOSHYAR_PORT='4173'\r\n"
        "$node = Join-Path $here 'node-runtime\\node.exe'\r\n"
        "$tsx = Join-Path $here 'node_modules\\tsx\\dist\\cli.mjs'\r\n"
        "$entry = Join-Path $here 'Backend\\HBOS\\Autonomous\\Runtime\\start-commercial-runtime.ts'\r\n"
        "$process = Start-Process -FilePath $node -ArgumentList @($tsx,$entry) -WorkingDirectory $here -PassThru\r\n"
        "try {\r\n"
        "  $deadline=(Get-Date).AddSeconds(20)\r\n"
        "  do {\r\n"
        "    try { $response=Invoke-RestMethod -Uri 'http://127.0.0.1:4173/health' -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 500 }\r\n"
        "  } while ((Get-Date) -lt $deadline)\r\n"
        "  if (-not $response -or $response.status -ne 'ok') { throw 'HooshyarOS runtime health check failed' }\r\n"
        "  Write-Output 'HooshyarOS installed and health-checked'\r\n"
        "}\r\n"
        "finally { if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force } }\r\n",
        encoding="utf-8",
    )


def _copy_repository_tree(source: Path, target: Path) -> None:
    shutil.copytree(
        source,
        target,
        ignore=lambda directory, names: [
            name for name in names
            if name in {"__pycache__", "node_modules"} or name.endswith((".pyc", ".test", ".spec"))
        ],
        dirs_exist_ok=True,
    )


def build_windows() -> Path:
    DIST.mkdir(parents=True, exist_ok=True)
    payload = DIST / "payload"
    if payload.exists():
        shutil.rmtree(payload)
    payload.mkdir(parents=True)

    for relative in ("Backend", "Docs", "Frontend", "product-manifest.json"):
        source = ROOT / relative
        if source.exists():
            target = payload / relative
            if source.is_dir():
                _copy_repository_tree(source, target)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)

    node_exe = shutil.which("node")
    if not node_exe:
        raise RuntimeError("Windows packaging requires Node.js on PATH")
    node_runtime = payload / "node-runtime"
    node_runtime.mkdir(parents=True, exist_ok=True)
    shutil.copy2(node_exe, node_runtime / "node.exe")

    # The complete runtime dependency closure lives at the payload root so that
    # normal Node resolution from Backend/HBOS/** (and the tsx executor) finds
    # every production package without NODE_PATH or developer node_modules.
    _copy_runtime_node_modules(ROOT, payload)

    if not ICON_ASSET.exists():
        raise RuntimeError(f"HooshyarOS installer icon asset missing: {ICON_ASSET}")
    shutil.copy2(ICON_ASSET, payload / "hooshyaros.ico")

    # IMPORTANT: package the real production web surface from ROOT/web.
    source_web = ROOT / "web"
    web = payload / "web"
    if not source_web.exists():
        raise RuntimeError(f"real web surface missing: {source_web}")
    shutil.copytree(source_web, web, ignore=lambda directory, names: [
        name for name in names if name in {"node_modules", "__pycache__"}
    ])

    (payload / "product-manifest.json").write_text(
        json.dumps({
            "name": "HooshyarOS",
            "runtime": "Backend/HBOS/Autonomous/Runtime/start-commercial-runtime.ts",
            "health": "/health",
            "web": "web/index.html",
        }, ensure_ascii=False),
        encoding="utf-8",
    )
    _write_launch_surface(payload)
    _validate_windows_payload(payload)

    bootstrap = DIST / "HooshyarOS-Windows-Bootstrap.zip"
    with zipfile.ZipFile(bootstrap, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in payload.rglob("*"):
            if file.is_file():
                archive.write(file, file.relative_to(payload))
    return bootstrap


def main() -> int:
    build_windows()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
