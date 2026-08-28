from pathlib import Path

from Backend.AI_Runtime import hooshyar_build


ROOT = Path(__file__).resolve().parents[2]


def test_two_command_entrypoint_exposes_both_phases():
    assert hooshyar_build.DAEMON.exists()
    assert hooshyar_build.TSX.name in {"tsx", "tsx.cmd"}
    assert hooshyar_build.HANDOFF_MARKER == '"type":"AUTONOMOUS_PLATFORM_CONTINUATION"'


def test_assistant_phase_is_distinct_from_platform_phase():
    assert hooshyar_build.run_daemon.__name__ == "run_daemon"
    assert "HOOSHYAR_BUILD_PHASE" in hooshyar_build.run_daemon.__code__.co_consts
    assert "HOOSHYAR_AUTONOMOUS_DEADLINE_DAYS" in hooshyar_build.run_daemon.__code__.co_consts


def test_build_entrypoint_is_python_first_and_repository_native():
    source = (ROOT / "hooshyar_build.py").read_text(encoding="utf-8")
    assert "HOOSHYAR_AGENT" in source
    assert '"python"' in source
    assert "subprocess.Popen" in source


def test_build_entrypoint_preserves_selected_implementation_agent():
    source = (ROOT / "hooshyar_build.py").read_text(encoding="utf-8")
    assert 'env["HOOSHYAR_AGENT"] = env.get("HOOSHYAR_AGENT", "auto")' in source
    assert 'env["HOOSHYAR_AGENT"] = "python"' not in source
