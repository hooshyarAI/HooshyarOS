from __future__ import annotations

import json
import subprocess
from pathlib import Path

import Backend.AI_Runtime.release_product_builder as builder


def _write_package(directory: Path, name: str, dependencies: dict[str, str] | None = None) -> Path:
    package_dir = directory / "node_modules" / name
    package_dir.mkdir(parents=True, exist_ok=True)
    (package_dir / "package.json").write_text(
        json.dumps({"name": name, "version": "1.0.0", "dependencies": dependencies or {}}),
        encoding="utf-8",
    )
    return package_dir


def test_production_dependency_roots_follow_package_json(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / "package.json").write_text(
        json.dumps({"dependencies": {"exceljs-hardened": "5.0.0", "mammoth": "^1.0.0"}}),
        encoding="utf-8",
    )
    monkeypatch.setattr(builder, "ROOT", tmp_path)

    roots = builder._production_dependency_roots()

    assert "exceljs-hardened" in roots
    assert "mammoth" in roots
    assert "tsx" in roots


def test_runtime_dependency_closure_preserves_nested_versions(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / "package.json").write_text(
        json.dumps({"dependencies": {"alpha": "1.0.0", "absent": "1.0.0"}}),
        encoding="utf-8",
    )
    _write_package(tmp_path, "alpha", {"beta": "2.0.0"})
    _write_package(tmp_path / "node_modules" / "alpha", "beta")
    _write_package(tmp_path, "tsx")

    monkeypatch.setattr(builder, "ROOT", tmp_path)
    names = builder._runtime_dependency_names()

    assert "node_modules/alpha" in names
    assert "node_modules/alpha/node_modules/beta" in names
    assert "node_modules/tsx" in names
    assert "node_modules/absent" not in names


def test_package_resolution_walks_up_and_stops_at_package_root(tmp_path: Path, monkeypatch) -> None:
    _write_package(tmp_path, "top")
    nested = _write_package(tmp_path / "node_modules" / "parent", "child")
    monkeypatch.setattr(builder, "ROOT", tmp_path)

    assert builder._resolve_package_dir("top", tmp_path, tmp_path) == tmp_path / "node_modules" / "top"
    assert builder._resolve_package_dir("child", tmp_path / "node_modules" / "parent", tmp_path) == nested
    assert builder._resolve_package_dir("missing", tmp_path, tmp_path) is None


def test_packaging_fails_when_runtime_dependency_cannot_resolve(tmp_path: Path, monkeypatch) -> None:
    payload = tmp_path / "payload"
    (payload / "node-runtime").mkdir(parents=True)
    (payload / "node-runtime" / "node.exe").write_bytes(b"MZ")
    (payload / "node_modules" / "tsx" / "dist").mkdir(parents=True)
    (payload / "node_modules" / "tsx" / "dist" / "cli.mjs").write_text("// tsx", encoding="utf-8")
    (payload / "Backend" / "HBOS" / "Autonomous" / "Runtime").mkdir(parents=True)
    (payload / "Backend" / "HBOS" / "Autonomous" / "Runtime" / "start-commercial-runtime.ts").write_text("// entry", encoding="utf-8")

    def fake_run(*args, **kwargs):  # noqa: ANN002, ANN003
        return subprocess.CompletedProcess(
            args=args,
            returncode=1,
            stdout="",
            stderr="Error: Cannot find module 'exceljs-hardened'",
        )

    monkeypatch.setattr(builder.subprocess, "run", fake_run)

    try:
        builder._validate_packaged_runtime(payload)
    except RuntimeError as error:
        assert "cannot resolve required npm dependencies" in str(error)
    else:
        raise AssertionError("packaging validation must fail when a runtime dependency cannot resolve")


def test_payload_validation_requires_all_runtime_artifacts(tmp_path: Path, monkeypatch) -> None:
    payload = tmp_path / "payload"
    (payload / "node-runtime").mkdir(parents=True)
    (payload / "node-runtime" / "node.exe").write_bytes(b"MZ")
    monkeypatch.setattr(builder, "_validate_windows_node_executable", lambda path: None)
    monkeypatch.setattr(builder, "_validate_packaged_runtime", lambda path: None)

    try:
        builder._validate_windows_payload(payload)
    except RuntimeError as error:
        message = str(error)
        assert "customer payload incomplete" in message
        assert "node_modules" in message
    else:
        raise AssertionError("payload validation must fail when runtime artifacts are missing")


def test_launch_surface_is_health_gated_and_fails_loudly(tmp_path: Path) -> None:
    builder._write_launch_surface(tmp_path)

    ps1 = (tmp_path / "launch-hooshyar.ps1").read_text(encoding="utf-8")
    vbs = (tmp_path / "launch-hooshyar.vbs").read_text(encoding="utf-8")
    cmd = (tmp_path / "launch-hooshyar.cmd").read_text(encoding="utf-8")
    health = (tmp_path / "install-health.ps1").read_text(encoding="utf-8")

    assert "Invoke-RestMethod -Uri $healthUrl" in ps1
    assert "$response.status -eq 'ok'" in ps1
    assert "$deadline = (Get-Date).AddSeconds(60)" in ps1
    assert ps1.index("$response.status -eq 'ok'") < ps1.index("Start-Process $url")
    assert "taskkill /PID $process.Id /T /F" in ps1
    assert "HooshyarOS startup failed" in ps1
    assert "exit 1" in ps1
    assert "node_modules\\tsx\\dist\\cli.mjs" in ps1

    assert "launch-hooshyar.ps1" in vbs
    assert "WScript.Sleep 2500" not in vbs
    assert "launch-hooshyar.ps1" in cmd
    assert "127.0.0.1:4173/health" in health
    assert "HooshyarOS installed and health-checked" in health


def test_icon_asset_is_present_and_valid() -> None:
    assert builder.ICON_ASSET.exists()
    header = builder.ICON_ASSET.read_bytes()[:4]
    assert header[0] == 0 and header[1] == 0
    assert header[2] == 1 and header[3] == 0
