"""Stage 8 evidence: Android productization must not overwrite the canonical runtime.

The repository ships a hardened Android client at
``android/app/src/main/java/ai/hooshyar/client/MainActivity.java`` (HTTPS-only
configuration, ``/health`` preflight, cleartext disabled). The productization
builder previously regenerated ``settings.gradle``, both ``build.gradle`` files,
the manifest, ``styles.xml`` and a minimal WebView fallback activity on every
run, silently overwriting the tracked improved sources.

These tests prove the scaffold is now non-destructive and only materialises a
fallback when the canonical client is absent.
"""
from __future__ import annotations

from pathlib import Path

import Backend.AI_Runtime.productization_builder as builder


def test_repository_canonical_android_client_is_not_overwritten() -> None:
    client = Path(builder.CANONICAL_ANDROID_CLIENT_ACTIVITY)
    manifest = Path(builder.ANDROID_ROOT) / "app" / "src" / "main" / "AndroidManifest.xml"
    app_gradle = Path(builder.ANDROID_ROOT) / "app" / "build.gradle"

    assert client.exists(), "canonical Android client runtime must be present in the repository"
    assert manifest.exists()
    assert app_gradle.exists()

    client_before = client.read_text(encoding="utf-8")
    manifest_before = manifest.read_text(encoding="utf-8")
    gradle_before = app_gradle.read_text(encoding="utf-8")

    # The canonical runtime carries the hardened HTTPS-only client contract.
    assert "isValidHttpsUrl" in client_before
    assert 'usesCleartextTraffic="false"' in manifest_before

    created = builder.scaffold_android_project()

    assert created == [], "productization must not generate scaffolding over the canonical project"
    assert client.read_text(encoding="utf-8") == client_before
    assert manifest.read_text(encoding="utf-8") == manifest_before
    assert app_gradle.read_text(encoding="utf-8") == gradle_before


def _redirect_builder_root(monkeypatch, root: Path) -> None:
    android_root = root / "android"
    monkeypatch.setattr(builder, "ROOT", root)
    monkeypatch.setattr(builder, "ANDROID_ROOT", android_root)
    monkeypatch.setattr(
        builder,
        "CANONICAL_ANDROID_CLIENT_ACTIVITY",
        android_root / "app" / "src" / "main" / "java" / "ai" / "hooshyar" / "client" / "MainActivity.java",
    )


def test_scaffold_creates_fallback_only_when_canonical_client_absent(tmp_path: Path, monkeypatch) -> None:
    _redirect_builder_root(monkeypatch, tmp_path)

    created = builder.scaffold_android_project()

    assert created, "a repository without the canonical client must receive fallback scaffolding"
    settings = tmp_path / "android" / "settings.gradle"
    fallback_activity = tmp_path / "android" / "app" / "src" / "main" / "java" / "ai" / "hooshyar" / "app" / "MainActivity.java"
    assert settings.exists()
    assert fallback_activity.exists()
    assert "class MainActivity" in fallback_activity.read_text(encoding="utf-8")


def test_scaffold_is_idempotent_and_preserves_manual_edits(tmp_path: Path, monkeypatch) -> None:
    _redirect_builder_root(monkeypatch, tmp_path)
    builder.scaffold_android_project()

    settings = tmp_path / "android" / "settings.gradle"
    marker = "// operator-tuned scaffold\n"
    settings.write_text(marker + settings.read_text(encoding="utf-8"), encoding="utf-8")

    created_again = builder.scaffold_android_project()

    assert created_again == []
    assert settings.read_text(encoding="utf-8").startswith(marker)
