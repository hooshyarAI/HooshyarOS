# HBOS Persistence Boundary

The canonical HBOS persistence boundary is `Backend/HBOS/Persistence/PersistenceBoundary.ts`.

It defines provider-neutral record operations and preserves tenant scope and evidence metadata at the application boundary.

This contract does not claim a production database is provisioned. Concrete database adapters, credentials, managed resources and deployment activation remain separate evidence-backed concerns.
