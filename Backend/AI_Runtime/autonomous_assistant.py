"""Explicit autonomous assistant/productization entrypoint.

This is a stable product-facing boundary. The HBOS TypeScript architecture remains
authoritative; this Python entrypoint delegates to the governed productization worker
rather than maintaining a second business implementation.
"""
from __future__ import annotations

from productization_worker import main


if __name__ == "__main__":
    raise SystemExit(main())
