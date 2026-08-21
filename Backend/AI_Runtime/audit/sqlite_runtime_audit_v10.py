from __future__ import annotations

import argparse
import json
import sqlite3
import tempfile
import threading
import time
from pathlib import Path


def run(database: Path, writers: int, writes_per_writer: int) -> dict:
    database.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(database)
    conn.execute("CREATE TABLE IF NOT EXISTS t (tenant_id TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, PRIMARY KEY (tenant_id, k))")
    conn.commit()
    conn.close()

    lock_errors = 0
    successful = 0
    latencies: list[float] = []
    guard = threading.Lock()

    def worker(worker_id: int) -> None:
        nonlocal lock_errors, successful
        for i in range(writes_per_writer):
            started = time.perf_counter()
            c = sqlite3.connect(database, timeout=0.1)
            try:
                c.execute("INSERT OR REPLACE INTO t (tenant_id,k,v) VALUES (?,?,?)", (f"tenant-{worker_id}", f"k-{i}", str(i)))
                c.commit()
                elapsed = (time.perf_counter() - started) * 1000
                with guard:
                    successful += 1
                    latencies.append(elapsed)
            except sqlite3.OperationalError as exc:
                if "locked" in str(exc).lower():
                    with guard:
                        lock_errors += 1
                else:
                    raise
            finally:
                c.close()

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(writers)]
    started = time.perf_counter()
    for t in threads: t.start()
    for t in threads: t.join()
    duration_ms = (time.perf_counter() - started) * 1000

    check = sqlite3.connect(database)
    count = check.execute("SELECT COUNT(*) FROM t").fetchone()[0]
    check.close()

    latencies.sort()
    def pct(p: float) -> float | None:
        if not latencies:
            return None
        idx = min(len(latencies) - 1, max(0, int(round((p / 100) * len(latencies) - 1))))
        return round(latencies[idx], 3)

    return {
        "writers": writers,
        "writes_per_writer": writes_per_writer,
        "successful_writes": successful,
        "lock_errors": lock_errors,
        "rows_after_run": count,
        "duration_ms": round(duration_ms, 3),
        "write_p50_ms": pct(50),
        "write_p95_ms": pct(95),
        "recovery_reopen": count > 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--writers", type=int, default=8)
    parser.add_argument("--writes", type=int, default=100)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    with tempfile.TemporaryDirectory(prefix="hooshyar-sqlite-audit-") as d:
        result = run(Path(d) / "audit.sqlite", args.writers, args.writes)

    result["mode"] = "LOCAL_SQLITE_CONCURRENCY_MEASUREMENT"
    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
