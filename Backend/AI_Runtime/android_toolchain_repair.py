"""Governed Android toolchain package repair.

The repair path is evidence-driven: repository metadata is discovered from
official Google endpoints, the requested package URL/checksum are read from
that metadata, and extraction is allowed only after integrity verification.
"""
from __future__ import annotations

import hashlib
import os
import shutil
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

OFFICIAL_METADATA_ENDPOINTS = (
    "https://dl.google.com/android/repository/repository2-3.xml",
    "https://dl.google.com/android/repository/repository2-2.xml",
    "https://dl.google.com/android/repository/repository2-1.xml",
)
OFFICIAL_PACKAGE_ROOT = "https://dl.google.com/android/repository/"


class AndroidRepairError(RuntimeError):
    pass


def _official_url(url: str, base: str = OFFICIAL_PACKAGE_ROOT) -> str:
    candidate = urllib.parse.urljoin(base, url)
    parsed = urllib.parse.urlparse(candidate)
    if parsed.scheme != "https" or parsed.netloc != "dl.google.com":
        raise AndroidRepairError(f"non-official Android repository URL rejected: {candidate}")
    return candidate


def _read_url(url: str, timeout: int = 30) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "HooshyarOS-AutonomousRepair/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def discover_metadata() -> tuple[str, bytes]:
    failures: list[str] = []
    for endpoint in OFFICIAL_METADATA_ENDPOINTS:
        try:
            data = _read_url(endpoint)
            if not data.strip():
                raise AndroidRepairError("empty metadata response")
            ET.fromstring(data)
            return endpoint, data
        except Exception as exc:
            failures.append(f"{endpoint}: {exc}")
    raise AndroidRepairError("no official Android repository metadata endpoint succeeded: " + " | ".join(failures))


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _child_text(node: ET.Element, name: str) -> str | None:
    for child in node.iter():
        if _local_name(child.tag) == name and child.text:
            return child.text.strip()
    return None


def resolve_package(metadata: bytes, package_path: str) -> tuple[str, str]:
    root = ET.fromstring(metadata)
    for package in root.iter():
        if _local_name(package.tag) != "remotePackage" or package.attrib.get("path") != package_path:
            continue
        for archive in package.iter():
            if _local_name(archive.tag) != "archive":
                continue
            host_os = _child_text(archive, "host-os")
            host_bits = _child_text(archive, "host-bits")
            if host_os and host_os.lower() not in {"windows", "win"}:
                continue
            if host_bits and host_bits not in {"64", "x86_64", "amd64"}:
                continue
            complete = next((n for n in archive if _local_name(n.tag) == "complete"), None)
            if complete is None:
                continue
            url_node = next((n for n in complete if _local_name(n.tag) == "url"), None)
            checksum_node = next((n for n in complete if _local_name(n.tag) == "checksum"), None)
            if url_node is None or checksum_node is None or not url_node.text or not checksum_node.text:
                continue
            return _official_url(url_node.text.strip()), checksum_node.text.strip().lower()
    raise AndroidRepairError(f"Windows package metadata not found: {package_path}")


def _checksum_algorithm(expected: str) -> str:
    length = len(expected)
    if length == 40:
        return "sha1"
    if length == 64:
        return "sha256"
    raise AndroidRepairError(f"unsupported package checksum format: {expected}")


def verify_checksum(path: Path, expected: str) -> None:
    algorithm = _checksum_algorithm(expected)
    digest = hashlib.new(algorithm)
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    actual = digest.hexdigest().lower()
    if actual != expected.lower():
        raise AndroidRepairError(f"checksum mismatch for {path.name}: expected {expected}, got {actual}")


def download_verified(url: str, expected_checksum: str, target: Path) -> None:
    url = _official_url(url)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + ".part")
    try:
        with urllib.request.urlopen(url, timeout=120) as response, temporary.open("wb") as handle:
            shutil.copyfileobj(response, handle)
        verify_checksum(temporary, expected_checksum)
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink()


def _safe_extract(zip_path: Path, destination: Path) -> None:
    destination = destination.resolve()
    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            target = (destination / member.filename).resolve()
            if os.path.commonpath((str(destination), str(target))) != str(destination):
                raise AndroidRepairError(f"unsafe archive path rejected: {member.filename}")
        zf.extractall(destination)


def install_from_metadata(sdk_root: Path, packages: list[str]) -> None:
    """Install packages without guessing URLs when sdkmanager cannot reach metadata."""
    metadata_endpoint, metadata = discover_metadata()
    cache = sdk_root.parent / "repository-cache"
    cache.mkdir(parents=True, exist_ok=True)
    for package_path in packages:
        url, checksum = resolve_package(metadata, package_path)
        filename = Path(urllib.parse.urlparse(url).path).name
        archive = cache / filename
        if archive.exists():
            try:
                verify_checksum(archive, checksum)
            except AndroidRepairError:
                archive.unlink()
        if not archive.exists():
            download_verified(url, checksum, archive)
        verify_checksum(archive, checksum)
        with tempfile.TemporaryDirectory(prefix="hooshyar-android-repair-") as temp:
            temp_path = Path(temp)
            _safe_extract(archive, temp_path)
            _install_extracted_package(temp_path, sdk_root, package_path)
    print(f"AUTONOMOUS_ANDROID_REPAIR metadata={metadata_endpoint} packages={','.join(packages)}")


def _install_extracted_package(extracted: Path, sdk_root: Path, package_path: str) -> None:
    if package_path == "platform-tools":
        source = extracted / "platform-tools"
        destination = sdk_root / "platform-tools"
    elif package_path.startswith("platforms;"):
        revision = package_path.split(";", 1)[1]
        source = extracted / f"android-{revision}"
        destination = sdk_root / "platforms" / f"android-{revision}"
    elif package_path.startswith("build-tools;"):
        revision = package_path.split(";", 1)[1]
        source = extracted / revision
        destination = sdk_root / "build-tools" / revision
    else:
        raise AndroidRepairError(f"unsupported direct package installation boundary: {package_path}")
    if not source.exists():
        raise AndroidRepairError(f"archive layout did not contain expected package root: {package_path}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(source, destination)
