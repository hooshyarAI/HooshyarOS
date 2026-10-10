# Commercial Identity Service

## Purpose

The existing CommercialIdentityService owns account onboarding, authentication, organization membership, role checks, session lifecycle and identity audit events. This implementation reuses the frozen architecture and does not add a duplicate engine.

## Persisted identity model

- The platform identity registry is stored atomically through SQLitePersistenceStore under an internal platform-only scope.
- Organization identity uses a random stable tenant ID stored with the organization record. It is never derived from a user-provided organization name.
- An organization owner registers with a username, organization name and password. Organization names are unique after Unicode normalization.
- Additional members join only with an expiring, single-use invitation code issued by an authorized OWNER/ADMIN account.
- Passwords are not stored in plaintext. A per-account random salt and Node.js scrypt-derived hash are persisted; password verification uses constant-time hash comparison.
- Login requires the correct username, organization and password. A new session receives the same persisted tenant ID as the registered account.
- Session tokens are random, HttpOnly/SameSite cookies, expire after 12 hours and can be revoked by logout.
- OWNER and ADMIN may manage users and executive targets; MANAGER may read and ingest; VIEWER is read-only. Permissions are enforced by the server.
- Invitation codes are stored as case-sensitive hashes, expire after seven days and are consumed once.
- Security-relevant identity and authorization events are stored in a bounded audit trail.

## Atomic persistence and tenant boundaries

SQLitePersistenceStore.mutate performs read/transform/write inside one SQLite IMMEDIATE transaction. Identity mutations use this method so concurrent registrations or invitation redemptions cannot silently overwrite the registry.

Organization data remains scoped by the random stable tenant ID. A client-supplied organization name never chooses the storage tenant. Typing an organization's name alone does not grant membership.

## API flow

- POST /api/session with mode=register: register the first owner of a new organization.
- POST /api/session with mode=login: verify account credentials and restore a session.
- POST /api/session with mode=join: redeem a single-use invitation.
- POST /api/invitations: authorized users issue a role-specific invitation code.
- GET /api/session: return the authenticated account, organization, role and tenant identifier.
- POST /api/logout: revoke the active session and clear the cookie.

## Remaining production controls

This is a foundation, not a claim of complete identity security. Password recovery, multi-factor authentication, deployment-grade distributed rate limiting, credential rotation, backup/restore validation and independent security review remain required before commercial production readiness is declared.
