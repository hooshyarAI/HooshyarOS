# CommercialPersistenceBoundary

Canonical product capability: `product.commercial.persistence-boundary`.

Target engine: Autonomous Operations Engine

Capability: provide a real canonical persistence boundary for commercial runtime capabilities

Dependencies: SQLitePersistenceStore

The product artifact is intentionally kept outside the engine implementation boundary.
The autonomous worker may enrich this contract only from repository architecture,
tests, dependencies and durable product evidence.
