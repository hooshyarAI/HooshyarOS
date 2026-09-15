# Executive Intelligence Workbench

## Capability

`product.executive-intelligence-workbench`

## Owning engine

Executive Intelligence Engine

## Purpose

Compose verified financial evidence into an executive KPI and performance workbench without creating a duplicate dashboard or intelligence engine.

## Contract

The capability requires a tenant identity, READY financial metrics, and explicit positive targets for revenue, profit, profit margin and debt ratio. The capability never invents business thresholds.

## Outputs

- KPI actual, target, variance and achievement rate
- performance status and achievement rate
- executive recommendation status
- tenant-scoped result
- fail-closed validation for invalid target input

## Dependencies

- Executive Intelligence Engine
- Financial Intelligence Engine

## Verification

`Backend/HBOS/test/ExecutiveIntelligenceWorkbench.test.ts`

Focused verification covers KPI composition, target validation and tenant-boundary preservation.
