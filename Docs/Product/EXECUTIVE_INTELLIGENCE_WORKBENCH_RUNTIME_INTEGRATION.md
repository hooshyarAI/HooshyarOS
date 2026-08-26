# Executive Intelligence Workbench Runtime Integration

## Capability

`product.executive-intelligence-workbench`

## Runtime boundary

The commercial runtime exposes `POST /api/executive/workbench` behind the existing authenticated tenant session. It consumes the tenant's latest verified financial analysis and requires explicit executive targets supplied by the caller.

## Persistence

The latest workbench result is stored under the tenant-scoped key `executive-intelligence-workbench:latest` and is surfaced by `GET /api/dashboard` as `executiveIntelligence`.

## Safety rules

No default KPI targets are invented. Missing targets return `EXECUTIVE_TARGETS_REQUIRED`. Missing or non-ready financial analysis returns `EXECUTIVE_ANALYSIS_REQUIRED`. Unauthenticated requests remain denied by the existing authentication boundary.

## Verification

`Backend/HBOS/test/ExecutiveIntelligenceWorkbench.runtime.test.ts` verifies the real runtime sequence: session, financial analysis, workbench execution, dashboard exposure, missing-target rejection and authentication enforcement.
