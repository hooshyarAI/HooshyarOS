from pathlib import Path
from zipfile import ZipFile, ZipInfo

import pytest

from AI_Runtime.android_toolchain_repair import AndroidRepairError, _validate_archive_members


def test_archive_member_validation_rejects_parent_traversal(tmp_path: Path):
    archive = tmp_path / "unsafe.zip"
    with ZipFile(archive, "w") as zf:
        zf.writestr("../escape.txt", "bad")
    with ZipFile(archive) as zf:
        with pytest.raises(AndroidRepairError, match="unsafe archive member"):
            _validate_archive_members(zf)


def test_archive_member_validation_accepts_normal_package_layout(tmp_path: Path):
    archive = tmp_path / "safe.zip"
    with ZipFile(archive, "w") as zf:
        zf.writestr("platform-tools/adb.exe", "ok")
        zf.writestr("platform-tools/source.properties", "ok")
    with ZipFile(archive) as zf:
        _validate_archive_members(zf)
