# Hooshyar Web + Mobile Product Contract

## Purpose
The commercial application shell is a responsive web/PWA product and must provide a coherent mobile experience. Mobile is not a deferred scope item.

## Required surfaces
- Desktop web application
- Responsive tablet layout
- Responsive mobile layout
- Installable PWA where supported
- Shared authentication/session context
- Shared organization/tenant context
- Shared navigation and capability access rules
- Shared dashboard/reporting contracts

## Product rule
The web and mobile experiences are two form factors of the same Hooshyar product. They must not invent separate business semantics or separate ownership for the same capability.

## Acceptance gates
A web/mobile shell is not commercially complete until:
1. the web app is runnable;
2. the same organization/user/session model is used across form factors;
3. core navigation is usable on mobile viewport sizes;
4. critical dashboard and assistant flows have responsive behavior;
5. PWA installation metadata/service-worker requirements are present where applicable;
6. API/application boundaries remain shared with HBOS;
7. mobile-specific gaps are represented explicitly in the commercial roadmap and completion audit.
