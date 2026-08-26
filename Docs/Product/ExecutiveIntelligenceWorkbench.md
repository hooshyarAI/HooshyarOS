# Executive Intelligence Workbench

## Capability

`product.executive-intelligence-workbench`

## Owning engine

Executive Intelligence Engine

## Purpose

Compose verified financial evidence into executive KPI, dashboard and performance intelligence without creating a duplicate dashboard or intelligence engine.

## Contract

The capability requires a tenant identity, verified financial metrics for revenue, profit, profit margin and debt ratio, and explicit targets for those same KPIs. Targets are supplied by the caller; the capability does not invent business thresholds.

## Outputs

- KPI actual, target, variance and achievement rate
- executive recommendation status
- performance status and achievement rate
- fail-closed validation for invalid tenant, metric or target input

## Verification

`Backend/HBOS/test/ExecutiveIntelligenceWorkbench.test.ts`

The focused tests verify canonical composition of verified financial metrics into executive KPIs and fail-closed validation.
