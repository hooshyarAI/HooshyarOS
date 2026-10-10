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
- Evaluation requires explicit, finite, positive targets; invalid targets are blocked instead of being treated as successful.
- The commercial runtime stores target values under tenant scope at `executive-kpi-targets:v1` through `POST /api/executive-targets`.
- The API target values for `profitMargin` and `debtRatio` are ratios, not percentages; the Persian UI accepts percentages and normalizes them before saving.
- `GET /api/dashboard` composes the latest verified financial metrics with these explicit targets via `ExecutiveIntelligenceWorkbench`; without configured targets, it returns no executive evaluation.

## Governance

Architecture Freeze V4 remains authoritative.
The engine reports `BLOCKED` for invalid executive KPI inputs rather than hiding missing or invalid evidence.
No additional engine or invented organization target is introduced; the workbench receives explicit targets from its caller.

## Status

Polarity-aware KPI evaluation is covered by focused engine and workbench runtime tests.
