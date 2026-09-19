# Phase 09 — Future Capability Registry (Deferred Tier 3)

This registry tracks methods that are explicitly DEFERRED from the canonical
Phase 09 implementation. Each entry contains the data required to re-evaluate
the deferral decision in a later phase or in the commercial completion track.

## Deferral Principle

Tier 3 capabilities are deferred because they require either:
- specialized research / external datasets that are not in the current evidence boundary;
- large engineering investment with low expected commercial value at the current
  stage (e.g., advanced copulas, SDEs, CGE/DSGE);
- data inputs that are not yet available in the canonical ingestion pipeline;
- numerical stability / convergence risk that warrants a dedicated
  research stage before production deployment.

The canonical Engines in the product remain the single source of truth for
financial, risk, and decision math. AI/Reasoning is interpretation only.

## Registry

### FCR-09-3.1 — Advanced Copulas (Gaussian / Clayton / Gumbel / t-copula)
- Domain: risk
- Reason for deferral: requires careful numerical implementation (multivariate CDFs,
  likelihood maximization). Marginal value at current product stage is limited.
- Required data: multivariate historical return series per tenant
- Dependencies: Phase 09-2.1 (Monte Carlo), Phase 09-2.2 (VaR/CVaR)
- Expected value: enables tail-dependence modeling beyond standard MC
- Complexity: high
- Re-evaluation condition: when product surface requires joint-distribution risk
  modeling for at least 3 correlated risk factors, or when a customer use-case
  specifically demands copula-based risk aggregation

### FCR-09-3.2 — Reinforcement Learning for Decision Policies
- Domain: decision
- Reason for deferral: AI/RL is explicitly out of scope for deterministic
  decision math; Hooshyar Autonomous Method is a deterministic decision
  engine with optional AI interpretation, not an RL agent.
- Required data: long-horizon state-action-reward tuples
- Dependencies: none within Phase 09; would need a dedicated ML research track
- Expected value: long-term optimization of repetitive decisions
- Complexity: very high
- Re-evaluation condition: a dedicated product decision explicitly opts in
  to RL-driven optimization AND evidence integrity is preserved (no
  autonomous RL training in production)

### FCR-09-3.3 — Advanced Derivatives Pricing (Black-Scholes variants, Heston, SABR)
- Domain: financial
- Reason for deferral: requires a financial-markets ingestion boundary that
  is not part of the current canonical ingestion. The current data model is
  tenant-driven financial statements, not market data feeds.
- Required data: market option prices, volatility surfaces
- Dependencies: market data ingestion (out of current scope)
- Expected value: enables derivative valuation and hedging analytics
- Complexity: high
- Re-evaluation condition: when a commercial use case explicitly requires
  derivatives analytics AND the market data ingestion boundary is
  implemented and tenant-scoped

### FCR-09-3.4 — Stochastic Differential Equations (SDE)
- Domain: financial / risk
- Reason for deferral: implementation of SDE solvers (Euler-Maruyama,
  Milstein) requires careful numerical analysis and a calibrated stochastic
  model. The current product line does not require continuous-time simulation
  for canonical decision support.
- Required data: time series of a stochastic observable
- Dependencies: Phase 09-2.1 (Monte Carlo)
- Expected value: continuous-time risk modeling
- Complexity: high
- Re-evaluation condition: a specific product decision requires continuous
  process modeling, or a research project is chartered

### FCR-09-3.5 — CGE / DSGE Macroeconomic Models
- Domain: strategic / financial
- Reason for deferral: computational general equilibrium and dynamic
  stochastic general equilibrium models require macroeconomic data
  pipelines and calibration infrastructure that are well outside the current
  tenant-isolated financial workbench.
- Required data: macroeconomic time series, behavioral parameters
- Dependencies: macroeconomic ingestion boundary (not in scope)
- Expected value: macro-level policy and investment scenario analysis
- Complexity: very high
- Re-evaluation condition: a strategic product line explicitly requires
  macro modeling

### FCR-09-3.6 — Advanced Growth Models (Lotka-Volterra, Bass diffusion, cohort)
- Domain: strategic / financial
- Reason for deferral: specialized models with strong parametric assumptions.
  The current cash-flow forecasting (naive, moving average, linear trend)
  and exponential smoothing cover the operational forecasting needs.
- Required data: cohort-segmented time series, network / adoption data
- Dependencies: extended ingestion (cohort-level)
- Expected value: adoption-diffusion analytics
- Complexity: medium
- Re-evaluation condition: customer adoption analytics are explicitly
  required in the commercial product

### FCR-09-3.7 — Blockchain / Distributed Ledger Accounting
- Domain: financial
- Reason for deferral: requires integration with external ledger networks
  and consensus-aware reconciliation. The current financial canonical
  model is a closed, tenant-scoped double-entry model.
- Required data: external ledger transactions
- Dependencies: external integration layer (not in scope)
- Expected value: cryptographic provenance for high-assurance accounting
- Complexity: very high
- Re-evaluation condition: a commercial customer explicitly requires
  blockchain-backed audit and the integration is approved by governance

### FCR-09-3.8 — Advanced Industrial-Production Models (Leontief input-output)
- Domain: strategic / decision
- Reason for deferral: requires industry-level matrix data not in the
  current tenant boundary. The current product does not own industry
  matrices.
- Required data: industry input-output matrices
- Dependencies: external industry data source
- Expected value: production network and supply-chain impact analysis
- Complexity: high
- Re-evaluation condition: a commercial use case requires supply-chain
  network impact modeling

## Maintenance

- Each entry is reviewed when the corresponding product decision is made
  or when a new commercial use case is chartered.
- Re-evaluation condition triggers a planning cycle that decides whether
  to promote the capability to Tier 1/2 in a future phase.
- The registry is append-only; entries are never deleted, only moved to
  the `Implemented` section when a capability is finally built.
