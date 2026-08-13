# SubscriptionEntitlementService

Canonical product capability: `product.commercial-subscription-entitlements`.

Target engine: Governance Engine

Capability: provide subscription plans, tenant entitlements, usage limits, trial/expiry behavior and billing-provider integration boundary when enabled

Dependencies: Organization Identity and RBAC, Tenant Persistence

The product artifact is intentionally kept outside the engine implementation boundary.
The autonomous worker may enrich this contract only from repository architecture,
tests, dependencies and durable product evidence.
