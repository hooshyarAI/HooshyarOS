# Executive Intelligence Engine

## Purpose

Canonical HBOS engine for executive decision intelligence.

It owns deterministic executive information primitives and does not replace the Decision Engine.

## Responsibilities

- Executive KPI analysis
- KPI variance and achievement measurement
- Executive status/recommendation signals
- Performance evaluation

## Contract

- Engine identity: `ExecutiveIntelligenceEngine`
- Lifecycle: `initialize()`
- Health: `health()`
- KPI analysis: `analyzeKpi(name, actual, target)`
- Executive recommendation: `recommend(kpi)`
- Performance evaluation: `evaluatePerformance(actual, target)`

## Governance

Architecture Freeze V4 remains authoritative.
The engine reports `BLOCKED` for invalid executive KPI inputs rather than hiding missing or invalid evidence.

## Status

Canonical implementation with focused test coverage; ready for integration with the Executive Intelligence composition layer.
