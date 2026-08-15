from __future__ import annotations

import json
from pathlib import Path

from .contracts import RepairRequest
from .repairers import GovernedRepairer, RepairAction
from .runner import APRVLRunner
from .toolkit import analyze_ci_log, canonical_path, compare_artifacts, dependency_closure, scan_repository
from .verifiers import verify_contract, verify_json, verified


def test_repository_scanner_and_canonical_paths(tmp_path: Path) -> None:
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.ts").write_text("export {};", encoding="utf-8")
    findings = scan_repository(tmp_path)
    assert canonical_path(tmp_path / "src" / "main.ts", tmp_path) == "src/main.ts"
    assert all(f.severity != "ERROR" for f in findings)


def test_ci_failure_analysis_is_evidence_based() -> None:
    findings = analyze_ci_log("FAIL src/a.test.ts\nENOENT /tmp/build\nnpm ERR! missing module")
    assert {f.category for f in findings} >= {"test-failure", "path", "dependency"}


def test_artifact_comparison_detects_drift(tmp_path: Path) -> None:
    left = tmp_path / "left"
    right = tmp_path / "right"
    left.mkdir(); right.mkdir()
    (left / "a.txt").write_text("a", encoding="utf-8")
    (right / "a.txt").write_text("b", encoding="utf-8")
    assert any("digests differ" in f.message for f in compare_artifacts(left, right))


def test_dependency_closure_accepts_lockfile(tmp_path: Path) -> None:
    (tmp_path / "package.json").write_text(json.dumps({"dependencies": {"x": "1"}}), encoding="utf-8")
    (tmp_path / "package-lock.json").write_text("{}", encoding="utf-8")
    assert dependency_closure(tmp_path) == ()


def test_contract_and_json_verifiers(tmp_path: Path) -> None:
    required = tmp_path / "required.txt"
    required.write_text("ok", encoding="utf-8")
    data = tmp_path / "data.json"
    data.write_text("{}", encoding="utf-8")
    assert verified(verify_contract(tmp_path, ("required.txt",)))
    assert verified(verify_json(data))


def test_governed_repairer_never_executes_unauthorized_action(tmp_path: Path) -> None:
    called = False
    def mutate() -> bool:
        nonlocal called
        called = True
        return True
    repairer = GovernedRepairer(tmp_path, {"verify-only"})
    try:
        repairer.execute(RepairAction("mutate", "mutation", True, mutate))
    except PermissionError:
        pass
    else:
        raise AssertionError("unauthorized action was accepted")
    assert not called


def test_runner_produces_deterministic_evidence(tmp_path: Path) -> None:
    request = RepairRequest("repository", "health", {}, ())
    runner = APRVLRunner(tmp_path)
    first = runner.evidence(request, runner.detect(request))
    second = runner.evidence(request, runner.detect(request))
    assert first.digest == second.digest
    assert first.source == "aprvl"
