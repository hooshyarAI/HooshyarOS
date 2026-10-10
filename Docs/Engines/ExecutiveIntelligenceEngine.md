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
- KPI analysis: `analyzeKpi(name, actual, target, direction?)`
- Direction values: `higher-is-better` and `lower-is-better`
- Executive recommendation: `recommend(kpi)`
- Performance evaluation: `evaluatePerformance(actual, target, direction?)`
- Direction defaults to `higher-is-better` for backward compatibility.
- The Executive Intelligence Workbench marks revenue, profit, and profit margin as higher-is-better and debt ratio as lower-is-better.
- Lower-is-better evaluation requires a positive target; invalid targets are blocked instead of being treated as successful.

## Governance

Architecture Freeze V4 remains authoritative.
The engine reports `BLOCKED` for invalid executive KPI inputs rather than hiding missing or invalid evidence.
No additional engine or invented organization target is introduced; the workbench receives explicit targets from its caller.

## Status

Polarity-aware KPI evaluation is covered by focused engine and workbench runtime tests.
