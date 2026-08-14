"""Repository-native Android command-line tool source policy."""
from __future__ import annotations

# Google-published Windows command-line tools package sources.
# Keep multiple official Google endpoints so productization can survive a
# transient CDN/redirector failure without requiring manual installation.
CMDLINE_TOOLS_URLS: tuple[str, ...] = (
    "https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip",
    "https://redirector.gvt1.com/edgedl/android/repository/commandlinetools-win-15859902_latest.zip",
    "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip",
    "https://redirector.gvt1.com/edgedl/android/repository/commandlinetools-win-13114758_latest.zip",
)
