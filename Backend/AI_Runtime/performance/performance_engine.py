"""Repository-native performance evidence primitives for HooshyarOS."""
from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Callable, TypeVar

T = TypeVar("T")

@dataclass(frozen=True)
class PerformanceSample:
    operation: str
    elapsed_ms: float


def evaluate(metric: str) -> dict[str, str]:
    return {"metric": metric, "status": "evaluated"}


def measure(operation: str, fn: Callable[[], T]) -> tuple[T, PerformanceSample]:
    started = perf_counter()
    value = fn()
    elapsed_ms = (perf_counter() - started) * 1000.0
    return value, PerformanceSample(operation=operation, elapsed_ms=elapsed_ms)


def benchmark(operation: str, fn: Callable[[], T], iterations: int = 1) -> PerformanceSample:
    if iterations < 1:
        raise ValueError("iterations must be >= 1")
    started = perf_counter()
    for _ in range(iterations):
        fn()
    elapsed_ms = (perf_counter() - started) * 1000.0
    return PerformanceSample(operation=operation, elapsed_ms=elapsed_ms)


class PerformanceEngine:
    """Compatibility service boundary over the canonical performance primitives."""

    def evaluate(self, metric: str) -> dict[str, str]:
        return evaluate(metric)

    def measure(self, operation: str, fn: Callable[[], T]) -> tuple[T, PerformanceSample]:
        return measure(operation, fn)

    def benchmark(self, operation: str, fn: Callable[[], T], iterations: int = 1) -> PerformanceSample:
        return benchmark(operation, fn, iterations)
