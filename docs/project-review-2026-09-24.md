# Vesper project review — 24 September 2026

## Assessment and scope

Vesper has both a substantial Next.js frontend and a modular FastAPI backend. It is an interactive academic prototype with partial API integration, not yet a fully connected resort management system. The immediate priority should be making a small number of operational flows reliable across devices before adding more screens or AI features.

Reviewed the current working checkout, including the integrated landing page, authentication, guest/staff request storage, API permissions, database models and migrations, action execution, event delivery, notifications, Docker configuration and test setup. This is a source review with a TypeScript check and Python syntax validation, not a completed penetration test or production load test. Application code was not changed.

Severity: P1 = fix before real operational use; P2 = important correctness or deployment issue. Demo-only behavior is acceptable when explicitly isolated and labelled.

## Corrections

### 1. P1 — Guest requests do not reach other devices

Evidence: `apps/web/app/guest/page.tsx:209`, `:275`; `apps/web/lib/demo/requests.ts:171`.

The guest page filters for Room 412 and creates orders through `addGuestRequest`. That helper writes localStorage and broadcasts a browser event. Storage events synchronize tabs on the same browser origin; they do not deliver a guest's order to a staff member's phone or persist it in PostgreSQL. The menu is also hardcoded. Staff and admin request views use the same demo module. Some review/performance features do call APIs, so integration is partial rather than entirely absent.

Correction: resolve the guest identity from the QR session, load `/guest/menu`, submit to `/guest/requests`, and fetch status from the backend. Connect the staff inbox to `/requests`. Keep fixtures behind an explicit demo mode. Verify an order from one browser session is accepted and completed from a second session and survives both browsers restarting.

### 2. P1 — Demo identity and real authentication are mixed

Evidence: `apps/web/components/auth/auth-context.tsx:66`, `:75`, `:122`, `:181`, `:208`.

The default identity is a general manager. Failed session restoration falls back to demo permissions, logout restores the GM role, and connected role switching signs into seeded accounts using credentials bundled in frontend code. If those seeded accounts are retained in a deployed database, their credentials are public. A failed role switch can also leave token storage and the displayed identity out of step.

Correction: separate demo and connected authentication modes. In connected mode, represent signed-out users as unauthenticated, send them to login, remove seeded-account switching, clear session-specific caches and tokens, and provision non-demo accounts. Client-side permissions alone do not bypass the backend, but the current combination is misleading and unsafe for a real deployment.

### 3. P1 — Deactivated users can refresh their sessions

Evidence: `app/api/identity/service.py:86`, `:181`; `packages/py-common/vesper_common/security.py:130`; `packages/py-common/vesper_common/config.py`.

Login checks `is_active`, but refresh does not. Deactivation changes the user row without revoking refresh sessions. Existing access tokens are accepted from their signed claims, with a default lifetime of 12 hours, without consulting account status. A deactivated user with a refresh token can obtain further access tokens.

Correction: reject refresh for inactive users, revoke sessions on deactivation, and implement an account/session version or revocation check for immediate access removal. Shorten access-token lifetimes and test deactivation, password reset, permission removal and logout explicitly.

### 4. P1 — User detail lookup crosses property boundaries

Evidence: `app/api/identity/router.py:127`; `app/api/identity/service.py:34`.

`GET /admin/users/{user_id}` checks `USERS_READ` but discards the principal's property. The lookup filters only by user UUID. A user with that permission in property A can request a known user UUID from property B and receive user details and permissions.

Correction: include the principal's property ID in the user lookup, returning not found for another property. Add two-property authorization tests. Global administrators, if needed, should have an explicit separate permission and path.

### 5. P1 — Every staff account can retrieve room QR credentials

Evidence: `app/api/property/router.py:169`; `app/api/guest/service.py` (`open_session`).

The room QR endpoint uses `current_user`, not a dedicated permission or internal-service restriction. Any staff account in a property can enumerate rooms and retrieve their QR secrets. Those secrets can then be used to open a guest session for an occupied room. The comment saying this credential goes nowhere near a browser is not enforced.

Correction: restrict verification credentials to internal calls. Provide a separately authorized, audited front-desk QR issuance workflow. Test that ordinary staff cannot retrieve secrets or impersonate another stay.

### 6. P1 — Operational events are permanently lost during failures

Evidence: `packages/py-common/vesper_common/events.py:174`, `:237`, `:272`; `app/api/guest/service.py:165`; `app/api/property/events.py`.

Writes commit before publishing their events. Publishing deliberately drops events when Redis fails, while consumers acknowledge messages even when handlers fail. Consumers read only new messages (`>`), without pending-message reclamation. These events drive task creation, stock deductions and room status changes, so losing them affects operations, not just live UI updates.

Correction: store an event outbox within the same database transaction as the business write. Publish it with retries; acknowledge consumer messages only after successful processing; reclaim abandoned pending messages; use dead-letter handling and idempotent consumers. Test Redis outages and consumer crashes during an order and checkout.

### 7. P1 — Fresh database migrations conflict with themselves

Evidence: `infra/migrations/versions/0001_initial_schema.py:38`; `17ce50d62c3e_staff_guest_reviews_and_blended_scoring.py:28`; `0003_guest_staff_reviews.py:30`; `0004_property_address.py:24`.

The initial migration imports today's ORM metadata and calls `create_all`. Today's models already contain review columns, review tables and the property address column. Subsequent migrations attempt to add those same objects. Source inspection therefore predicts duplicate-column/table failures on a fresh `alembic upgrade head`; this was not executed against a fresh PostgreSQL instance during the review.

Correction: make the baseline an immutable definition of the schema at revision 0001. Preserve subsequent incremental migrations. Test both an empty database upgrade and an upgrade from an older populated database.

### 8. P1 — Concurrent check-ins can allocate the same room twice

Evidence: `app/api/frontdesk/service.py:130`; `app/api/frontdesk/models.py:83`.

Check-in reads whether the room is occupied and then inserts a stay without a database lock or active-room uniqueness constraint. Two requests can both observe an empty room. The stay model also lacks a unique booking constraint despite defining a one-to-one relationship.

Correction: enforce one active stay per property/room and one stay per booking in PostgreSQL, coordinate check-in in a transaction, and translate uniqueness conflicts into useful errors. Add a concurrent check-in test. Also validate that the allocated room matches the booking category, or explicitly record an authorized upgrade.

### 9. P1 — Action approval can execute more than once

Evidence: `app/api/action/service.py:128`, `:208`, `:243`, `:589`.

Claim and approval use read-then-write state checks without atomic ownership. Approval commits `APPROVED` before executing the downstream action, and `_assert_actionable` does not reject that state. Concurrent approvals or a retry while execution is still in progress can therefore reach the executor more than once. Exact downstream impact depends on the executor.

Correction: atomically transition to an executing state with one owner, give each execution an idempotency key, and distinguish retryable failures from in-progress work. Persist outcomes so a retry cannot overwrite the original undo snapshot or repeat side effects.

### 10. P2 — TypeScript defects are hidden by build configuration

Evidence: `apps/web/app/admin/rates/page.tsx:334`, `:438`; `apps/web/app/admin/maintenance/page.tsx:112`; `apps/web/next.config.mjs:15`.

The rates page uses `chartColors` without importing it, which can throw when the affected tab renders. Maintenance creates a work order with lowercase priorities including `urgent`, while `WorkOrder` accepts `Low | Medium | High`. The TypeScript check reports four diagnostics. Next.js explicitly ignores type errors during builds, allowing these defects through.

Correction: import the chart palette, normalize the priority model across the UI and API, and make type checking a mandatory build/CI gate. Do not simply cast away the priority mismatch. The integrated landing files produced no TypeScript diagnostics.

### 11. P2 — Docker API URL is supplied at the wrong stage

Evidence: `apps/web/Dockerfile:16`; `docker-compose.yml:62`.

The Dockerfile inlines `NEXT_PUBLIC_API_URL` at build time, but Compose only supplies a runtime environment variable. Changing that Compose variable will not change the already-built browser bundle. On a remote deployment, its default localhost URL points to the visitor's computer.

Correction: pass the value through `build.args`, or use a same-origin API proxy with server-side configuration. Parameterize the hardcoded database connection too; Compose currently depends on a specifically configured PostgreSQL server on the host and does not supply a database service.

### 12. P2 — Rate limiting blocks the async event loop

Evidence: `app/rate_limit.py:55`, `:82`, `:110`.

Async middleware directly executes a synchronous Redis pipeline. There are no explicit socket timeouts on that client. A slow Redis request can stall other requests handled by the same event loop, including otherwise lightweight traffic.

Correction: use an async Redis client or move the synchronous work into a worker thread. Set bounded connection/read timeouts and define outage behavior separately for login and ordinary API traffic. Validate with a slow or disconnected Redis instance.

### 13. P2 — WebSocket history bypasses department filtering

Evidence: `app/api/notification/router.py:46`; `app/api/notification/service.py` (`Hub.broadcast`).

Live broadcasts apply a department filter, but initial backlog delivery filters only by property. Connecting or reconnecting can therefore expose recent events from other departments to staff who would not receive those events live.

Correction: centralize event visibility and apply it consistently to backlog and live delivery. Include role/permission restrictions and token expiry handling. Test two staff accounts from different departments.

### 14. P2 — Refresh tokens are not uniquely minted per session

Evidence: `packages/py-common/vesper_common/security.py:59`; `app/api/identity/service.py:86`; `app/api/identity/models.py` (`RefreshSession`).

Refresh tokens contain a user ID, type and timestamps, but no random session identifier. Tokens minted for the same user in the same JWT timestamp second can be identical. The database does not require token hashes to be unique; lookup takes the first match. Quick successive logins or rotations can therefore create ambiguous session rows. Refresh consumption also lacks a row lock.

Correction: include a random token/session ID, enforce unique fingerprints, and consume refresh sessions atomically. Test rapid login/refresh and simultaneous refresh attempts. This conclusion is from source inspection, not an executed token reproduction.

### 15. P2 — Edited system role permissions are overwritten on sync

Evidence: `app/api/identity/service.py:115`, `:225`; `app/api/identity/jobs.py:26`.

Role editing updates permissions but leaves `is_system` true. The synchronization job overwrites system-role permissions with shipped defaults. This contradicts the documented promise that operator-edited roles remain untouched and can restore a grant the administrator removed.

Correction: track operator overrides separately or mark customized roles appropriately; apply default changes through a controlled migration. Test that an edited system role survives synchronization.

## Improvement sequence

1. Establish a reliable development and release baseline: fix types, repair fresh migrations, parameterize setup, and add CI. `.github/workflows` currently contains only a placeholder. Keep build failures visible.
2. Finish one real cross-device flow: QR scan → order → staff acceptance → delivery → inventory deduction → guest rating. Include cancellation, retries, duplicate submissions, checkout and server restart.
3. Separate demo fixtures from connected data through explicit adapters. Show whether data is simulated, loading, stale or unavailable; never silently replace a failed live operation with a success-looking demo state.
4. Harden sessions and authorization: eliminate deployed demo credentials, enforce token types, isolate tenant/stay caches, use a deliberate session-storage design, and reject development JWT secrets in production. The current default secret has no production startup validation.
5. Add integration tests with PostgreSQL and Redis, plus browser tests for the complete flow above. Unit tests alone cannot establish transaction, isolation or delivery guarantees.
6. Add operational visibility: failed event counts, pending-message age, action execution status, request latency, structured request IDs and alerts. Build a tested backup/restore procedure before storing real hotel data.
7. Improve maintainability by splitting large page components, using shared status/priority types, and validating frontend/API contracts. Keep the modular monolith; another microservice split would not address the current defects.
8. Improve product usability with consistent empty/error states, keyboard/focus checks, mobile workflow testing and clear action outcomes. Align the advertised undo period with the backend: landing copy says 10 seconds, while the action service allows 600 seconds.
9. Treat AI output as advisory until measured on representative data. Expose model/fallback status, record human overrides, monitor prediction quality, and keep approval and audit records. Notification providers are currently mocked, so a `sent` status must not be presented as evidence of an actual email/SMS/WhatsApp delivery.

## Verification and limits

- Ran `node node_modules/typescript/bin/tsc --noEmit --incremental false --pretty false` in `apps/web`: failed with four diagnostics in rates and maintenance.
- Parsed 145 Python source files across `app`, the shared Python package, `infra` and `tests`: no syntax errors. This does not validate imports or runtime behavior.
- Attempted pytest using the available Python runtimes: all lacked pytest, so the backend suite was not run. No packages were installed and no database was modified for this review.
- Did not run a clean Docker build, live PostgreSQL migration, concurrency/load test, vulnerability dependency scan or browser accessibility audit. Security findings above are code-level findings with their conditions stated.
- Existing landing-page changes and the existing package-lock modification were left intact. This review adds only this report.
