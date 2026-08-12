"""Compatibility performance evidence adapter for HooshyarOS."""
from __future__ import annotations

from Backend.AI_Runtime.performance.performance_engine import (
    PerformanceSample,
    benchmark,
    evaluate as evaluate_metric,
    measure,
)


class PerformanceEngine:
    """Class-based facade preserved for legacy AI Runtime consumers."""

    def evaluate(self, metric: object) -> dict[str, object]:
        return evaluate_metric(metric)

    def measure(self, operation: str, fn):
        return measure(operation, fn)

    def benchmark(self, operation: str, fn, iterations: int = 1):
        return benchmark(operation, fn, iterations)


__all__ = [
    "PerformanceEngine",
    "PerformanceSample",
    "benchmark",
    "evaluate_metric",
    "measure",
]
