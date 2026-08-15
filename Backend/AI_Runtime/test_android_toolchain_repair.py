import hashlib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from android_toolchain_repair import (
    AndroidRepairError,
    OFFICIAL_PACKAGE_ROOT,
    resolve_package,
    verify_checksum,
    _official_url,
)


class AndroidToolchainRepairTests(unittest.TestCase):
    METADATA = b'''<repository>
      <remotePackage path="build-tools;34.0.0">
        <archives><archive><complete>
          <checksum>0123456789012345678901234567890123456789</checksum>
          <url>build-tools_r34-windows.zip</url>
        </complete></archive></archives>
      </remotePackage>
    </repository>'''

    def test_resolves_package_url_and_checksum_from_metadata(self):
        url, checksum = resolve_package(self.METADATA, "build-tools;34.0.0")
        self.assertEqual(url, OFFICIAL_PACKAGE_ROOT + "build-tools_r34-windows.zip")
        self.assertEqual(checksum, "0123456789012345678901234567890123456789")

    def test_rejects_non_official_package_source(self):
        with self.assertRaises(AndroidRepairError):
            _official_url("https://example.invalid/package.zip")

    def test_rejects_checksum_mismatch_before_installation(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "package.zip"
            path.write_bytes(b"known content")
            expected = hashlib.sha1(b"different content").hexdigest()
            with self.assertRaises(AndroidRepairError):
                verify_checksum(path, expected)

    def test_metadata_endpoint_selection_is_ordered_and_stops_on_valid_xml(self):
        import android_toolchain_repair as repair
        calls = []

        def fake_read(url, timeout=30):
            calls.append(url)
            if len(calls) == 1:
                raise OSError("blocked")
            return self.METADATA

        with patch.object(repair, "_read_url", side_effect=fake_read):
            endpoint, data = repair.discover_metadata()
        self.assertEqual(endpoint, repair.OFFICIAL_METADATA_ENDPOINTS[1])
        self.assertEqual(data, self.METADATA)
        self.assertEqual(calls, list(repair.OFFICIAL_METADATA_ENDPOINTS[:2]))


if __name__ == "__main__":
    unittest.main()
