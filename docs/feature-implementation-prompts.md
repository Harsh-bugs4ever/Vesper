# Vesper feature implementation prompts

Prepared from source inspection on 2026-09-26. This is an implementation plan; application code has not been changed or runtime-tested as part of this inspection.

## What the repository already contains

- Next.js 15 / React 19 / TypeScript frontend under `apps/web`, with React Query and Tailwind.
- FastAPI / SQLAlchemy backend under `app/api`, shared security under `packages/py-common/vesper_common`, PostgreSQL migrations under `infra/migrations`.
- Existing modules for identity, property, front desk, staff, guest requests, inventory, maintenance, workforce, notifications, action cards and guest intelligence. Extend these boundaries instead of rebuilding the app.
- `apps/web/lib/session.ts` merges Owner and GM into `general_manager`, and maps managers outside housekeeping/F&B to the F&B presentation role.
- Backend roles are owner, gm, manager, supervisor, employee and guest. Default permissions inherit upward, including operational and AI permissions that conflict with the requested restrictions.
- `app/api/staff/router.py` accepts department filters without consistently constraining them to the caller. A department selector is not an authorization boundary.
- The initial WebSocket backlog in `app/api/notification/router.py` filters by property only. Its visibility needs the same policy as live delivery.
- `apps/web/app/admin/communications/page.tsx` uses demo outbox/import data. Department conversations require persisted models and APIs.
- `apps/web/app/admin/rooms/page.tsx` contains a simulated resort scene. Room models already support occupied/ready/dirty/etc., but have no room-image collection. Category amenities are strings, not a resort amenity availability catalogue.
- Front desk already has `/bookings/today` for arrivals, departures and in-house counts. Reuse it.
- Concierge code already returns escalation signals; staff event handlers already turn requests/issues into tasks. Extend and verify the complete handoff rather than implementing a disconnected second queue.
- Demo data exists beyond the landing page. `toUiProperty` spreads `DEMO_PROPERTY` into connected data, so production cleanup must include fallback behavior.

## Working product decisions

Items 1 and 2 incorporate the confirmed role clarification. The remaining items are explicit planning assumptions; resolve changes in Phase 1 before dependent implementation.

1. Confirmed: exactly three internal roles — General Manager, Manager (department/branch scoped), and Staff. Guests retain a separate stay-scoped portal. Remove System Admin as a product role. Defer all Owner-specific features; do not create an Owner dashboard or access profile.
2. GM is the single top-level business role and receives guest/property/business overview, cross-department operational summaries, attendance, performance, budgets, query topics and AI analytics. Routine approvals belong to the responsible department manager. Give GM explicit account/role administration capabilities needed after removing System Admin, without silently adding routine department approval authority.
3. Managers are scoped to assigned branches/properties and departments. A branch manager may supervise multiple explicitly assigned departments in one branch; absence of a department must never mean unrestricted access.
4. Branch maps to the existing Property entity unless business requirements identify a different concept. Property switching requires authorized membership, not a client-side property ID change.
5. Housekeeping includes a Maintenance tab/workflow. Engineering remains a distinct department where present; housekeeping can coordinate linked room defects without gaining unrelated engineering records.
6. Department managers receive concise operational metrics. “AI & Analytics only for GM” means forecasts, model/learning tools and executive AI insights; guest concierge remains available to guests as explicitly requested. Ordinary department counts and employee performance remain available to authorized managers.
7. “Staff reports” means staff-submitted operational issues/shortages/incidents. Existing staff/guest review records also need department scope where appropriate.
8. Confirmed: do not use frontend mock data anywhere in the application. Remove frontend demo fixtures, demo roles/property, simulated timers, fabricated counters and all imports from `apps/web/lib/demo` in production pages and shared components. Test fixtures may live only in test files. If an API or data source is missing, show a truthful unavailable/empty state and add the backend contract needed; never substitute sample records. Do not delete existing database records or remove truthful academic/non-affiliation disclosures just to make the product appear live.

## How to use these prompts

Run phases in order. Each phase delivers backend and frontend together; complete its checks before continuing. Paste the common instruction followed by one phase prompt. Paths below are relative to the repository root `D:\Vesper`.

### Common instruction — prepend to every phase

```text
Work in the existing Vesper repository at D:\Vesper. Read docs/feature-implementation-prompts.md, especially the product decisions, and inspect the current source before editing. Implement only the phase below. Preserve unrelated working changes.

Extend existing FastAPI module/service boundaries and Next.js components. Server-side authorization is mandatory for every read, mutation, aggregation, export and live event; hiding navigation is only a UI concern. Derive allowed property/department scope from authenticated memberships, and validate all referenced objects against it. Keep guest access restricted to the active stay.

Use additive, reviewable Alembic migrations and safe backfills. Do not reset the database or purge data. The frontend must not import or render mock/demo records anywhere: no `apps/web/lib/demo` data, `DEMO_USERS`, `DEMO_PROPERTY`, simulated timers, fabricated metrics or automatic fallback after API failure. Replace every affected view with real endpoints and honest loading, empty, unavailable and error states. Test-only fixtures belong in test files.

Update API schemas, export OpenAPI using scripts/export_contracts.py when contracts change, and update frontend types/callers. Use existing styling and accessible responsive components. Test the phase's business transitions and forbidden access, not just rendering. Run relevant pytest tests, TypeScript checking and the web production build when applicable; report unavailable dependencies or infrastructure honestly.

Finish with changed behavior, files, migrations, checks and any unresolved decisions. Do not claim completion if a button only changes local state or the backend path is unimplemented. Do not implement subsequent phases automatically.
```

### Phase 1 — Resolve roles, access matrix and branch scope

```text
Define and implement the canonical role and scope foundation.

Backend: inspect permissions.py, security.py, identity models/service/router and property departments. Replace accidental upward inheritance with explicit grants appropriate to GM, Manager and Staff. Keep guest sessions separate. Model authorized property memberships and manager department assignments if current one-property/one-department fields cannot support the agreed branch model. Backfill existing users without granting new access. Remove System Admin and Owner from selectable roles and production UI branches. Migrate legacy owner accounts to GM while preserving identity and audit history; map supervisors to scoped Manager or Staff based on actual duties. Remove System Admin demo identities; any persisted custom system_admin account needs an explicit migration mapping to one of the three supported roles, without silently elevating it. Update seeds, defaults, role-management forms and session compatibility. Assign account/role administration to GM explicitly; do not leave a hidden superuser role. Add explicit capabilities for executive overview, department overview, approvals, employee performance, resort twin and GM AI tools. Ensure revoked memberships/roles cannot retain access through stale sessions beyond a documented invalidation mechanism.

Frontend: replace department-specific role names and the fallback-to-F&B behavior in lib/auth.ts and lib/session.ts. Preserve role, department IDs and authorized property scope independently. Auth context must expose the server's effective capabilities and scopes. Clear cached data on logout, account change and property switch.

Acceptance: document a resource/action/scope matrix for every requested feature. Verify only GM, Manager and Staff are assignable internal roles, no System Admin/Owner dashboard remains, a front-desk manager remains front desk, and users cannot select an unassigned branch. No-department managers fail closed. Existing accounts migrate predictably. Record unresolved product choices explicitly before applying a conflicting policy.
```

### Phase 2 — Enforce isolation across API, navigation and live data

```text
Apply Phase 1's policy to existing surfaces before adding new features.

Backend: centralize scope resolution and enforce it in staff, guest, inventory, frontdesk, workforce, maintenance, reviews, action dashboard and notification modules. Validate object ownership for detail and mutation routes as well as list routes. Requested department filters may narrow authorized scope but never widen it. Filter nested records, totals, exports and employee dropdowns. Apply one visibility policy to WebSocket backlog and live events, including events with missing department metadata. Prevent operational employees from reading unrelated guest or staff data.

Frontend: update RoleGuard, admin/staff layouts, sidebar, login redirects and direct route guards. Route each user to their own dashboard family. Remove demo role switching and mock-user session fallback entirely. Include property/department/user scope in query keys where relevant and prevent previous-scope data flashing during switches.

Acceptance: tests cover at least two properties and two departments, unauthorized query parameters, guessed object IDs, direct URLs, aggregate counts, exports and WebSocket backlog/live delivery. Front-desk staff can reach permitted front-desk operations without receiving the general admin dashboard. Staff and guests cannot access the resort twin or AI analytics APIs.
```

### Phase 3 — Landing page, About and truthful production data

```text
Update apps/web/app/page.tsx and its landing components while retaining the established visual style.

Frontend: remove fabricated operational counters, simulated activity and demo-entry behavior from the public landing page. Add a real About navigation anchor and section explaining Vesper, whom it serves and its department-based workflow, using only verified project facts. Correct the old owner/GM purchasing story to department-manager approval. Keep login and guest-entry flows clear. Review all hardcoded landing claims; do not invent resort amenities, affiliations or business statistics.

Backend/data integration: use persisted public property content only if the page needs it; do not expose operational endpoints publicly. Remove DEMO_PROPERTY merging into connected responses and replace missing fields with explicit optional values and unavailable states. Inventory every `apps/web/lib/demo` import in application source, remove it, and connect the screen to real data in the phase that owns that feature. Remove the `lib/demo` application data modules when no import remains. Disable all demo fallback after API/session failures. Keep static labels/icons only when they describe real UI concepts and are not disguised business records.

Acceptance: About navigation works on mobile and desktop; no public operational data leaks; disconnected or empty data never becomes simulated data. Preserve truthful project/non-affiliation disclosures where applicable. No application page or shared component imports `apps/web/lib/demo` or references frontend demo users/property.
```

### Phase 4 — Room images, amenities and reliable occupancy

```text
Extend property models/schemas/service and guest-safe property responses.

Backend: add ordered room/category image metadata with alt text and a primary image, using an existing storage mechanism or a documented managed upload approach. Validate allowed file types, size and write permissions. Add resort amenities with description, location, opening hours, availability and closure notes. Authorize editing through explicit property-content permissions. Return guest-safe amenity and room information without exposing other guests or internal room notes.

Separate occupancy from housekeeping/serviceability where needed: a room can be occupied and need cleaning. Derive occupied/vacant state from active stays and preserve housekeeping and out-of-order state independently. Audit all consumers, including guest QR validation, checkout, room allocation, housekeeping and dashboard counts, before migrating the existing status enum. Preserve checkout token invalidation and prevent overlapping active room allocations.

Frontend: add image galleries to room details and room/category cards, with honest missing-image placeholders. Show explicit occupied/vacant and housekeeping/serviceability badges on operational screens. Add an Amenities section to the guest portal with actual availability and hours.

Acceptance: occupied rooms remain occupied during cleaning; checkout updates occupancy and housekeeping correctly and invalidates guest access. Guests see available/closed amenities accurately and cannot enumerate other occupied-room profiles. Authorized room image edits persist after reload.
```

### Phase 5 — Front desk arrivals, departures and profiles

```text
Build the complete Front Desk workspace for front-desk employees and their manager.

Backend: reuse /bookings/today and the existing bookings, stays and visit/profile services. Provide authorized date filtering, arrivals, departures, in-house guests and relevant guest/stay context. Grant operational permissions specifically to front-desk membership. Preserve valid booking/check-in/check-out transitions, room readiness checks, concurrent allocation protection and guest-session lifecycle.

Frontend: update admin/front-desk and provide an authorized entry from the front-desk staff workspace. Include Arrivals, Departures and In-house tabs, guest profile drawers, room image/status context, search and date filters. Managers can review their front-desk operation; employees can perform their permitted work. GM overview links expose guest/stay data allowed by the matrix.

Acceptance: front-desk employee and manager can access arrivals/departures and profiles; F&B users cannot access unrelated profiles. Counts and room states agree after check-in/out. Duplicate check-in and unavailable-room assignment fail clearly without partial writes.
```

### Phase 6 — Department workspaces, staff tasks and maintenance

```text
Separate manager supervision from staff execution across housekeeping, maintenance and other departments.

Backend: extend existing staff tasks, issue reports and maintenance work orders. Staff see their assigned tasks and only the department pool they are explicitly allowed to claim. Managers see scoped operational summaries, assignments, escalations and approvals, not a personal to-do list. Route staff reports to their responsible department manager; retain reporter, category, property, department, evidence and lifecycle. Validate assignee membership and task/work-order transitions server-side.

Frontend: show My Tasks, progress and report submission in the Staff workspace. Manager dashboards show concise counts, overdue work, reports and approval queues with drilldowns. Add Maintenance within Housekeeping for room defects and linked work orders; engineering retains ownership of engineering work. Do not give housekeeping blanket engineering access. Scope review/report lists and notifications to the relevant department.

Acceptance: a housekeeping employee reports a defect; the configured responsible manager receives it; an authorized worker completes it; linked status updates persist. Managers have no personal task checklist. Staff cannot complete another user's task or assign work across departments without explicit authority.
```

### Phase 7 — AI-first guest help and contextual handoffs

```text
Complete the guest question-to-human-resolution flow using guest, guest_intel and staff modules.

Backend: inspect the existing concierge escalation persistence before extending it. Persist conversations/messages and link human handoffs to existing requests/tasks where possible. Use supported resort knowledge for informational answers. Route actionable requests, explicit requests for a human, complaints and unresolved queries to the appropriate department manager. Use deterministic request-category rules first and validated classification for ambiguous free text; use a configured front-desk triage fallback when uncertain. Store topic, department, reason, ownership and resolution status.

Reuse the existing event-driven request-to-task path. Make handoff/task creation idempotent under retries and duplicate events. Support manager acknowledgement, reassignment within policy, staff delegation and guest-visible progress. Never claim a booking, purchase or service action occurred before the backend transaction succeeds. Provider failure must still permit a real human handoff.

Frontend: connect guest chat to persisted AI responses and visible human handoff status. Give managers only their department's escalations and relevant conversation context. Add a clear human-assistance action, resolution messages and request tracking.

Acceptance: towels route to housekeeping, food to F&B, room faults to maintenance, check-in questions requiring action to front desk; ambiguous requests reach triage. Retries create one request/task. Guests cannot see another stay's thread, and unrelated managers cannot read the transcript.
```

### Phase 8 — Department communications and GM topic overview

```text
Replace the communications demo outbox screen with persisted department communications, reusing Phase 7's conversation primitives where appropriate.

Backend: support internal department threads, staff reports and guest handoff conversations with explicit audience/type. Store participants, department, topic, messages, unread state, assignment and resolution. Internal notes must never appear in guest-visible responses. Allow only authorized scoped participants; enforce the same policy in notifications and realtime events. Keep delivery outbox administration separate from operational conversations. Provide a GM summary grouped by department/topic with counts, urgency, unresolved age and status, without returning every full transcript by default.

Frontend: department managers receive an inbox for their department; staff see only permitted threads. GM sees query topics and actionable summaries with policy-controlled drilldown. Move any still-needed CSV import and delivery diagnostics to appropriately restricted administration pages.

Acceptance: cross-department message access and event delivery are denied. Manager replies and guest-visible updates reach the correct thread. Internal notes stay internal. GM topic totals match persisted conversations and use the selected property/date scope.
```

### Phase 9 — Inventory requests, department approvals and budgets

```text
Extend inventory purchasing to support staff requisitions and accountable department budgets.

Backend: add persisted requisitions with requester, department/property, requested items/quantities, reason, status and approval history. Staff create and track their own requests. Only the responsible department manager approves/rejects them with recorded reasons. Convert approved requisitions into existing purchase orders idempotently; preserve ordering/receiving and stock-movement audit trails. Department scope must remain stable even if an item's ownership later changes. Reuse existing PO flows where possible instead of creating competing approval paths.

Add department/period/currency budget allocations and explicit allocated, committed, spent and remaining calculations. Define when commitment becomes spending and how cancellation, partial receipt and returns affect totals. Prevent double counting and concurrent duplicate approval/receipt. Implement the agreed authorized budget-editing policy; GM must have cross-department budget/spending visibility. Do not invent approval thresholds.

Frontend: staff get Request Supplies and My Requests; managers get department stock, requisitions, approvals and purchase orders; GM gets allocation/spending summaries and filters. Operational approvals must remain usable without GM-only AI pages.

Acceptance: staff cannot approve; another department manager cannot view or approve the request/PO; duplicate approval produces one PO; partial receipt adjusts inventory/budget correctly. GM totals reconcile with the persisted purchasing ledger.
```

### Phase 10 — Attendance, performance and role-specific summaries

```text
Build data-backed GM and department-manager overviews using existing dashboard, staff, workforce and performance services.

Backend: GM receives property/business and guest overview plus all authorized departments' attendance and employee performance; department managers receive only their own operational/team summaries. Staff retain their own attendance and permitted self-performance. Expose scoped branch, department, employee and period filters. Employee dropdown choices must use the same scope as results. Define performance metrics, periods, denominators and minimum-data behavior from actual attendance/tasks/reviews; do not fabricate scores or imply absent data is poor performance.

Frontend: replace one-size-fits-all overview content. GM gets department and employee dropdowns with concise attendance/performance summaries. Managers get relevant counts, exceptions, reports and approvals without unrelated financial/model panels or personal tasks. GM also gets occupancy, arrivals/departures, guest overview and business summary. Distinguish unavailable data from zero and show freshness/date range.

Acceptance: changing department resets incompatible employee selections; managers cannot retrieve another team's performance by ID; GM can compare all authorized departments; GM sees the guest overview. No Owner-specific workspace is implemented. Operational summaries remain available without granting access to AI analytics.
```

### Phase 11 — Manager-only resort twin and GM-only AI analytics

```text
Apply the final specialist-surface restrictions and replace their simulated content.

Backend: expose resort twin data only to authorized managers and GM, within branch scope and with minimal room details. Separate GM AI/analytics permissions from ordinary dashboard and departmental approval permissions. Protect forecast, simulator, learning/model tools, insight endpoints, settings and exports accordingly. Guest concierge is an explicit exception. AI-generated operational recommendations may feed ordinary department approvals without exposing model dashboards.

Frontend: update admin/rooms to use persisted rooms/statuses/images with a genuine spatial representation if required; remove artificial loading and random/simulated occupancy. If a measured 3D model is unavailable, provide an honest schematic resort view and document the asset dependency rather than claiming a physical digital twin. Gate route, data fetching and navigation to managers/GM.

Refine GM AI & Analytics into a compact overview: concise operational summary, top actionable exceptions, recommended next actions, data period/freshness and uncertainty or insufficient-data states. Keep technical model details in optional drilldowns. Use grounded metrics; an AI provider outage should leave a deterministic factual summary available. Keep existing department approvals reachable outside these pages.

Acceptance: staff and guests cannot load the twin; non-GM users cannot directly fetch AI analytics. GM summaries agree with source metrics and contain no demo forecasts. Managers can still approve their own department's operational requests.
```

### Phase 12 — Full workflow verification and release readiness

```text
Verify the integrated requirements and close remaining production demo dependencies.

Backend: run the relevant existing pytest suite plus integration tests for membership isolation, object-level authorization, guest-stay ownership, transitions, approvals, event retries and budget reconciliation. Exercise migrations on both a clean database and a copy of the previous schema with representative data. Audit direct endpoints, exports, aggregate counts and WebSocket backlog/live delivery against the final matrix. Regenerate and validate OpenAPI.

Frontend: run TypeScript checking and the Next.js production build. Add or use an appropriate browser test harness for meaningful role journeys. Verify responsive layouts, keyboard access, empty/loading/error states and state/cache clearing after account/property changes. Search all application source for `lib/demo`, `DEMO_USERS`, `DEMO_PROPERTY`, mock arrays, random figures and simulated timers. Remove application demo modules when unused. Test-only fixtures may remain inside test files; application code must not render them. Check every page against its real API response, including backend-empty and backend-unavailable conditions.

Exercise: guest towel request -> housekeeping manager -> staff completion -> guest status; defect report -> responsible manager -> maintenance completion; staff requisition -> department approval -> PO -> receipt -> GM budget; front-desk arrival -> room occupied -> departure -> room dirty and guest token revoked. Test negative access with a second department and second property for each journey.

Acceptance: produce a requirement-to-screen/API/test checklist covering every original request, with pass/fail evidence. Document remaining external assets or infrastructure dependencies, migration/rollback steps and deployment configuration. Do not hide failures behind demo data, drop data or deploy automatically as part of verification.
```

## Sequence and completion

Phases 1–2 establish policy and isolation. Phase 3 removes misleading entry behavior. Phases 4–6 establish operational data and workspaces. Phases 7–8 complete service routing and communication. Phase 9 adds purchasing/budgets. Phase 10 assembles executive and department summaries. Phase 11 finishes restricted specialist views. Phase 12 verifies the whole product.

The role clarification is incorporated: GM, Manager and Staff; no System Admin; Owner features deferred. Branch-manager scope and housekeeping/engineering ownership remain explicit planning assumptions until confirmed.

