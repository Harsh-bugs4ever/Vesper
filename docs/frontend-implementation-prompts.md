# Vesper frontend implementation prompts

These prompts replace the earlier frontend prompts. Run each after its matching backend phase. The application must not use frontend mock data, including during development. Test fixtures are permitted only inside automated tests and must never be imported by application code.

## Common instruction — prepend to every phase

```text
Work in D:\Vesper, primarily apps/web. Implement only the requested frontend phase against the actual backend API contracts. Inspect the existing API client, session handling and components before editing. Preserve unrelated changes and the established visual style.

Mandatory data policy:
- Do not import or render data from apps/web/lib/demo, DEMO_USERS or DEMO_PROPERTY.
- Do not introduce hardcoded business records, sample users, mock API handlers, random metrics, canned AI answers, simulated delays or fake success messages.
- Remove demo mode, demo role switching and automatic mock fallback after failed API calls.
- All users, roles, permissions, branches, departments, rooms, occupancy, amenities, tasks, requests, messages, inventory, purchase orders, budgets, attendance, performance and analytics must come from authenticated backend responses or appropriately public backend endpoints.
- Static UI labels, icons, status presentation maps and verified About copy may remain in frontend code. They must not contain fabricated business records or operational values.
- Use actual loading, empty, unavailable and error states. Missing data is not zero. An API failure must not replace real data with samples.
- If an endpoint is absent, document its required request/response contract and keep the affected feature explicitly unavailable. Do not invent a successful response or claim the feature is complete.
- Persist mutations through APIs. Forms may hold unsaved input locally, but success and saved status require a successful server response. Handle conflicts and failed writes clearly.
- Use real backend roles and permissions: General Manager, Manager and Staff; guest sessions remain separate. Remove System Admin. Owner-specific features are deferred.
- Scope queries and cache keys by the relevant user/property/department. Clear protected cached data when sessions or assignments change.

Use the existing typed API client and React Query patterns. Keep route guards and navigation aligned with backend permissions; the backend remains responsible for authorization. Use responsive, keyboard-accessible components.

For the changed screens, verify successful responses, empty responses, API failure and forbidden access. Run TypeScript checking and the web production build when dependencies are available. Report changed files, API dependencies and actual verification results. Automated test fixtures must stay in tests; they must not become application data sources.
```

## Phase 1 — Remove mock infrastructure and implement role access

```text
Implement frontend Phase 1: real sessions, role-aware access and removal of mock infrastructure.

Inspect lib/auth.ts, lib/session.ts, lib/api.ts, components/auth, components/layout, login, admin/staff layouts, components/connected and every importer of lib/demo.

1. Inventory every application mock dependency, including hardcoded arrays outside lib/demo. Map each business dataset to its real endpoint. Disconnect mock sources immediately; existing screens without an endpoint must show an explicit unavailable state until their feature phase connects them.
2. Remove DEMO_USERS, DEMO_PROPERTY, mock session restoration and demo role switching. Remove automatic general-manager identity before authentication completes. Show session loading or redirect to login instead.
3. Remove the mapping that presents non-housekeeping/non-F&B managers as F&B. Preserve the actual backend role, department IDs, property memberships and permission list independently.
4. Support only General Manager, Manager and Staff as internal roles. Remove System Admin and Owner UI options. Keep guest stay sessions separate.
5. Redirect users to their authorized dashboard. Build navigation and direct-route access from effective capabilities and assignments.
6. Front-desk staff must be able to reach their permitted operations without access to the general management dashboard.
7. Remove DEMO_PROPERTY spreading from toUiProperty. Represent absent backend fields explicitly instead of supplying invented property details.
8. Extract legitimate static types and presentation maps from demo modules into ordinary type/config modules where needed. Delete application demo data modules after removing all importers.
9. Clear cached protected data on logout, account changes and property changes. Prevent data from a previous scope flashing during loading.

Complete when application source no longer imports frontend mock datasets, real login drives role access, and missing services show honest unavailable states. Produce a remaining API-integration checklist for later phases; unavailable features are not completed features.
```

## Phase 2 — Landing page, room images and guest amenities

```text
Implement frontend Phase 2 using the backend property, room and guest-safe amenity APIs.

1. Update app/page.tsx and landing components to remove simulated counters, operational activity and demo entry points.
2. Add a working About navigation link and an actual About section explaining Vesper and its department-based workflow with verified project facts.
3. Update the purchasing story so the responsible department manager handles routine approvals. Preserve truthful project/non-affiliation disclosures where applicable.
4. Use real public property content when needed. Never fetch private operational data for the public landing page.
5. Add room/category galleries using backend-provided image records, ordering and alt text. Missing photos show a neutral placeholder; do not substitute stock imagery and claim it depicts that room.
6. Show occupancy and housekeeping/serviceability as distinct statuses from backend responses. Do not infer occupied/vacant from fabricated room lists.
7. Add a guest Amenities section showing persisted availability, hours, location and closure notes. Do not hardcode the resort's amenity catalogue.
8. Keep guest responses limited to their own stay and guest-safe property information.

Verify About navigation, responsive galleries, missing photos, closed amenities, occupied rooms requiring cleaning and API failure states. Complete only when these views use the real contracts and all unavailable dependencies are reported.
```

## Phase 3 — Front desk, staff work and housekeeping maintenance

```text
Implement frontend Phase 3 against frontdesk, staff and maintenance APIs.

1. Reuse /bookings/today and related guest/stay endpoints for Arrivals, Departures and In-house tabs. Add date filters, search, guest-profile drawers and real room image/status context.
2. Make the workspace available to front-desk staff and their manager using actual permissions.
3. Staff dashboard: show assigned personal tasks, progress, attendance actions and staff-report submission.
4. Manager dashboard: show scoped operational counts, overdue work, staff reports, assignments and approvals. Remove personal to-do lists from managers.
5. Add Maintenance within Housekeeping for relevant room defects and linked work orders. Show engineering-owned work only to the extent permitted by the backend.
6. Task assignment, start, completion, attendance, check-in/out and report submission must call real mutation endpoints. Update views from successful responses and invalidate dependent queries.
7. Surface permission, conflict and validation failures. Never turn a failed mutation into a local success or use timers to simulate completion.
8. Remove any remaining hardcoded task, booking, staff or maintenance records in these components.

Verify front-desk arrival/departure actions, staff task completion and housekeeping defect reporting through reloads. Check unrelated-department access is denied and an unavailable API leaves the action unavailable with a clear explanation.
```

## Phase 4 — Guest AI handoff and department communications

```text
Implement frontend Phase 4 against persisted concierge, escalation and conversation APIs.

1. Guest chat must display actual backend AI answers and conversation history. Remove canned answers, simulated typing responses and fabricated citations. A typing/loading indicator may reflect a real pending request.
2. Add Request Human Assistance and show persisted escalation status, department ownership and guest-request progress.
3. Managers see only the escalations and conversation context returned for their department scope. Add permitted acknowledgement, delegation, reply and resolution actions.
4. Replace the Communications demo outbox/import interface with a department inbox backed by persisted threads, messages and unread status.
5. Staff see only permitted threads. Distinguish internal notes from guest-visible replies and use the appropriate backend message visibility field.
6. GM sees actual query-topic summaries by department, urgency, unresolved age and status.
7. Keep delivery diagnostics and CSV import on separately authorized administration pages if still required.
8. Subscribe to real scoped live events or use deliberate polling. Do not create local sample messages or fake unread counts.
9. On message failure, preserve unsent text and show retry status. Display handoff success only after the backend confirms the persisted handoff.

Verify a guest request reaches the correct department manager, replies survive reload, internal notes remain internal and GM topic counts come from real responses. AI/provider failure must display the backend's actual fallback/handoff outcome.
```

## Phase 5 — Inventory requests, purchase orders and GM budgets

```text
Implement frontend Phase 5 against real inventory, requisition, purchase-order and budget endpoints.

1. Staff get Request Supplies and My Requests, populated from authorized inventory items and their persisted requests.
2. Managers get scoped stock summaries, pending requisitions, approval/rejection controls and purchase orders.
3. Display actual requester, items, quantities, reasons, decision history and receipt status.
4. Require rejection reasons and call real approval/rejection endpoints. Disable repeated submission while pending and handle server conflicts without fabricating success.
5. GM gets allocated, committed, spent and remaining budget by department and period, using backend-defined amounts and currency.
6. Do not calculate invented budgets, fill charts with sample spending or assume a missing value means zero. Show unavailable or insufficient-data states appropriately.
7. Use authorized department options from the backend and include scope in query keys.
8. Keep manager purchasing approvals reachable outside GM-only AI analytics.
9. Refresh related requisition, PO, stock and budget queries after successful mutations. Preserve unsaved form input if a request fails.

Verify staff submission -> manager approval -> PO -> receipt -> GM budget update using real persisted records. Reload each step and confirm unrelated department records are not displayed.
```

## Phase 6 — Dashboards, performance, resort view and AI analytics

```text
Implement frontend Phase 6 using real overview, attendance, performance, room/spatial and analytics endpoints.

1. GM dashboard shows actual guest/property overview, occupancy, arrivals/departures, department summaries and actionable exceptions.
2. Add attendance/performance views with backend-authorized department and employee dropdowns and period filters. Reset incompatible employee selections when the department changes.
3. Manager dashboards show only relevant operational/team summaries, reports and approvals. Staff dashboards remain focused on personal work. Do not add Owner or System Admin dashboards.
4. Use backend-defined performance metrics and minimum-data states. Remove sample staff scores, invented trends and frontend-generated performance rankings.
5. Restrict Resort 3D navigation, route access and data fetching to managers and GM. Use actual property room/status data and supported spatial assets. Remove artificial loading delays and simulated occupancy.
6. If spatial assets are missing, show an unavailable state or a clearly labeled schematic based on actual room data. Do not fabricate geometry and present it as a measured resort model.
7. Restrict AI & Analytics to GM, including direct routes. Preserve guest concierge and ordinary department summaries under their own permissions.
8. Present concise backend-generated insights, priority exceptions and next actions with source period and freshness. Offer detailed model information through optional drilldowns.
9. Use factual backend summaries when the AI provider is unavailable. Never generate canned insight text or demo forecasts in the browser.
10. Audit all remaining application pages, including pages outside these six feature groups, for lib/demo, DEMO_USERS, DEMO_PROPERTY, embedded business arrays, random business values, fake timers and success-only local mutations. Replace them with real APIs or explicitly unavailable states. Remove unused mock modules.

Run TypeScript checks and the production build. Verify populated, empty, forbidden and failed API states; role-based direct URLs; and cache clearing between accounts/properties. Produce a screen-to-endpoint checklist proving every operational value has a real source, and list missing backend integrations explicitly instead of claiming full completion.
```
