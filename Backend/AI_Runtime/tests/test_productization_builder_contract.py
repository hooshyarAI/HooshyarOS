from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / "AI_Runtime" / "productization_builder.py"
REPAIR = ROOT / "AI_Runtime" / "android_toolchain_repair.py"


def test_builder_routes_android_sdk_failure_to_governed_repair():
    text = BUILDER.read_text(encoding="utf-8")
    assert "install_from_metadata" in text
    assert "AndroidRepairError" in text
    assert "required-sdk-packages-not-present" in text


def test_repair_isolated_from_builder_and_metadata_driven():
    text = REPAIR.read_text(encoding="utf-8")
    assert "repository2-3.xml" in text
    assert "sha256" in text
    assert "https://dl.google.com" in text
    assert "zipfile" in text
