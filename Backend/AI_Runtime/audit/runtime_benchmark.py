from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    index = (len(values) - 1) * p
    lo = int(index)
    hi = min(lo + 1, len(values) - 1)
    if lo == hi:
        return values[lo]
    return values[lo] + (values[hi] - values[lo]) * (index - lo)


def request(url: str, method: str = "GET", body: bytes | None = None) -> tuple[int, float]:
    req = Request(url, data=body, method=method, headers={"content-type": "application/json"})
    started = time.perf_counter()
    with urlopen(req, timeout=5) as response:
        response.read()
        return response.status, (time.perf_counter() - started) * 1000


def benchmark(base_url: str, iterations: int) -> dict:
    endpoints = [
        ("health", "GET", "/health", None),
        ("ready", "GET", "/api/ready", None),
        ("dashboard", "GET", "/api/dashboard", None),
        ("session", "POST", "/api/session", b'{"organization":"audit"}'),
    ]
    results = {}
    for name, method, path, body in endpoints:
        samples: list[float] = []
        statuses: list[int] = []
        errors = 0
        for _ in range(iterations):
            try:
                status, elapsed = request(base_url + path, method, body)
                statuses.append(status)
                samples.append(elapsed)
            except (URLError, TimeoutError, OSError):
                errors += 1
        results[name] = {
            "iterations": iterations,
            "successes": len(samples),
            "errors": errors,
            "error_rate": round(errors / iterations, 4),
            "status_codes": sorted(set(statuses)),
            "p50_ms": round(percentile(samples, 0.50), 3),
            "p95_ms": round(percentile(samples, 0.95), 3),
            "p99_ms": round(percentile(samples, 0.99), 3),
            "max_ms": round(max(samples), 3) if samples else None,
            "mean_ms": round(statistics.mean(samples), 3) if samples else None,
        }
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8787")
    parser.add_argument("--iterations", type=int, default=50)
    parser.add_argument("--out", default="AuditOutput/runtime_benchmark.json")
    args = parser.parse_args()

    result = {
        "mode": "LOCAL_RUNTIME_MEASUREMENT",
        "target": args.url,
        "iterations": args.iterations,
        "results": benchmark(args.url, args.iterations),
    }
    out = Path(args.out).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
