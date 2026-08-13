# SubscriptionEntitlementService

Canonical product capability: `product.commercial-subscription-entitlements`.

Target engine: Governance Engine

Capability: repair commercial quality failure for product.commercial-subscription-entitlements: provide subscription plans, tenant entitlements, usage limits, trial/expiry behavior and billing-provider integration boundary when enabled

Dependencies: Organization Identity and RBAC, Tenant Persistence

The product artifact exposes deterministic capability-shaped behavior derived from
the declared product contract. Repair missions never alter the canonical product
identity; they only repair and re-verify the same commercial artifact boundary.
