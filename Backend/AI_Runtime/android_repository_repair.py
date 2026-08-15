"""Governed Android SDK repository discovery and package verification.

Repair law:
DETECT -> ISOLATE -> DIAGNOSE -> PLAN -> REPAIR -> VERIFY

No package URL is guessed. URLs and checksums are selected from official
Google Android SDK repository metadata and a package is never accepted for
extraction until its declared checksum matches the downloaded bytes.
"""
from __future__ import annotations

import hashlib
import io
import tempfile
import urllib.request
import unittest
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urljoin

GOOGLE_REPOSITORY_BASE = "https://dl.google.com/android/repository/"
OFFICIAL_METADATA_ENDPOINTS = (
    "repository2-3.xml",
    "repository2-2.xml",
    "repository2-1.xml",
)


@dataclass(frozen=True)
class AndroidPackageArtifact:
    package_path: str
    url: str
    checksum_type: str
    checksum: str


class AndroidRepositoryRepair:
    """Discover, select, download and verify one Android SDK package."""

    def __init__(self, opener=urllib.request.urlopen, repository_base: str = GOOGLE_REPOSITORY_BASE) -> None:
        self._opener = opener
        self._repository_base = repository_base.rstrip("/") + "/"

    def detect_metadata(self) -> tuple[str, bytes]:
        """Detect the first reachable official repository metadata endpoint."""
        failures: list[str] = []
        for endpoint in OFFICIAL_METADATA_ENDPOINTS:
            url = urljoin(self._repository_base, endpoint)
            try:
                with self._opener(url, timeout=15) as response:
                    payload = response.read()
                if payload:
                    return url, payload
                failures.append(f"{url}: empty response")
            except Exception as exc:
                failures.append(f"{url}: {exc}")
        raise RuntimeError("Android repository metadata unavailable: " + " | ".join(failures))

    def diagnose_package(self, metadata: bytes, package_path: str, host_os: str = "windows") -> AndroidPackageArtifact:
        """Resolve package URL and checksum exclusively from repository metadata."""
        root = ET.fromstring(metadata)
        for package in root.iter():
            if not package.tag.endswith("remotePackage") or package.attrib.get("path") != package_path:
                continue
            for archive in package.iter():
                if not archive.tag.endswith("archive") or archive.attrib.get("host-os") != host_os:
                    continue
                complete = next((node for node in archive.iter() if node.tag.endswith("complete")), None)
                if complete is None:
                    continue
                url_node = next((node for node in complete.iter() if node.tag.endswith("url")), None)
                checksum_node = next((node for node in complete.iter() if node.tag.endswith("checksum")), None)
                if url_node is None or not (url_node.text or "").strip():
                    continue
                if checksum_node is None or not (checksum_node.text or "").strip():
                    raise RuntimeError(f"Repository metadata has no checksum for {package_path}")
                checksum_type = checksum_node.attrib.get("type", "").strip().lower()
                if checksum_type not in {"sha1", "sha256", "md5"}:
                    raise RuntimeError(f"Unsupported repository checksum type for {package_path}: {checksum_type}")
                return AndroidPackageArtifact(
                    package_path=package_path,
                    url=urljoin(self._repository_base, (url_node.text or "").strip()),
                    checksum_type=checksum_type,
                    checksum=(checksum_node.text or "").strip().lower(),
                )
        raise RuntimeError(f"Android package not found in official repository metadata: {package_path}")

    def download_and_verify(self, artifact: AndroidPackageArtifact, target: Path) -> Path:
        """Download an artifact and reject it unless its metadata checksum matches."""
        target.parent.mkdir(parents=True, exist_ok=True)
        with self._opener(artifact.url, timeout=60) as response, target.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)

        digest = hashlib.new(artifact.checksum_type)
        with target.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(chunk)
        actual = digest.hexdigest().lower()
        if actual != artifact.checksum:
            target.unlink(missing_ok=True)
            raise RuntimeError(
                f"Android package checksum mismatch for {artifact.package_path}: "
                f"expected {artifact.checksum}, got {actual}"
            )
        return target

    def provision(self, package_path: str, target: Path, host_os: str = "windows") -> Path:
        """Run the governed DETECT -> DIAGNOSE -> PLAN -> REPAIR -> VERIFY path."""
        _, metadata = self.detect_metadata()
        artifact = self.diagnose_package(metadata, package_path, host_os=host_os)
        return self.download_and_verify(artifact, target)


# Single capability test: metadata-selected URL + checksum verification + tamper rejection.
def test_android_repository_repair() -> None:
    payload = b"verified android package"
    checksum = hashlib.sha256(payload).hexdigest()
    metadata = f'''<?xml version="1.0"?>
<sdk:repository xmlns:sdk="urn:test">
  <sdk:remotePackage path="build-tools;34.0.0">
    <sdk:archives>
      <sdk:archive host-os="windows">
        <sdk:complete>
          <sdk:url>build-tools_r34.0.0-windows.zip</sdk:url>
          <sdk:checksum type="sha256">{checksum}</sdk:checksum>
        </sdk:complete>
      </sdk:archive>
    </sdk:archives>
  </sdk:remotePackage>
</sdk:repository>
'''.encode()

    class FakeResponse(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            self.close()

    calls: list[str] = []

    def opener(url: str, timeout: int):
        calls.append(url)
        if url.endswith("repository2-3.xml"):
            return FakeResponse(metadata)
        return FakeResponse(payload)

    repair = AndroidRepositoryRepair(opener=opener)
    detected_url, detected_metadata = repair.detect_metadata()
    assert detected_url.endswith("repository2-3.xml")
    artifact = repair.diagnose_package(detected_metadata, "build-tools;34.0.0")
    assert artifact.url == "https://dl.google.com/android/repository/build-tools_r34.0.0-windows.zip"
    assert artifact.checksum_type == "sha256"

    with tempfile.TemporaryDirectory() as directory:
        target = repair.download_and_verify(artifact, Path(directory) / "build-tools.zip")
        assert target.read_bytes() == payload

        tampered = AndroidPackageArtifact(
            package_path=artifact.package_path,
            url=artifact.url,
            checksum_type=artifact.checksum_type,
            checksum="0" * 64,
        )
        rejected = Path(directory) / "tampered.zip"
        try:
            repair.download_and_verify(tampered, rejected)
        except RuntimeError as exc:
            assert "checksum mismatch" in str(exc)
        else:
            raise AssertionError("tampered package was not rejected")

    assert calls[0].endswith("repository2-3.xml")


if __name__ == "__main__":
    test_android_repository_repair()
    print("PASS: android repository repair")
