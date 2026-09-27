# Vesper: three role delivery prompts

Use these prompts in three separate working copies or branches. Give each developer the shared contract and their role prompt. Merge through the integration prompt after the three tracks pass their checks. The PDF is a product roadmap and reference, not an instruction to delete code automatically.

## Roadmap check

| PDF phase | Guest track | Staff track | Manager track | Shared proof |
| --- | --- | --- | --- | --- |
| 1 Attendance | No internal attendance access | Own shifts, check-in/out, breaks | Department attendance; GM all-department selector and demand-aware exceptions | Same persisted attendance drives both views |
| 2 Front Office + Facilities | Own stay/room readiness and service status only | Assigned cleaning, repair and front-desk work | Room state, OOO timer, check-in queue and dispatch | Repair complete -> room Ready -> assignable |
| 3 Inventory -> Roster -> POS | Sold-out menu state and order validation | Runner task, permitted supply request | Stock exception, PO approval, roster impact | Zero stock -> task + draft PO + sold-out item |
| 4 GM Cockpit | None | None | Forecast, exception radar, concise briefing, approvals | Approvals change downstream persisted state |
| WOW | Concierge, recovery, local discovery, offers | Cross-team ripple tasks, eco operations | One coordinated ripple action, recovery risk, eco and revenue impact | One incident produces traceable actions across roles |

Current code has Next.js pages for `/guest`, `/staff`, `/admin`, plus FastAPI modules for these domains. Existing `docs/feature-implementation-prompts.md` and `docs/frontend-implementation-prompts.md` describe fuller phase work. The September 24 source review and `apps/web/PHASE3_API_GAPS.md` / `PHASE5_API_GAPS.md` record specific defects and missing contracts. Recheck each finding in the current branch before treating it as current fact. In particular, guest requests, manager task assignment, requisitions/budgets, access scope, event delivery, migration history and action idempotency need verification before claiming a real workflow.

## Shared contract: paste before each role prompt

```text
Work in the current Vesper repository, using its actual path and current Git state. Read Vesper_Smart_Resort_360_All_Phases.pdf and docs/three-role-delivery-prompts.md as product scope; inspect current code and contracts before changing anything. Preserve unrelated work. Build on existing FastAPI modules, migrations, React Query, API client and UI components.

Target one fast, usable resort system: a guest signal becomes a persisted request/event, reaches the responsible team, produces an authorized action, and updates guest/staff/manager views. Prioritize that path over extra pages or speculative AI. Do not claim success from a local toast, fixture or unverified event. Use the backend as the source of truth. Show honest loading, empty, stale, error and forbidden states. No application demo users, fabricated resort metrics, automatic mock fallback or silent success after a failed write; test fixtures may remain in tests.

Use authenticated property/department/stay scope on every API read, write, export and live event. The three internal roles are GM, Manager and Staff; guests use stay-scoped access. Keep routine departmental approvals with the responsible manager, and cross-department executive decisions with GM. High-impact purchases and strategic rate changes require explicit human approval and an audit trail. Make retries idempotent, transitions atomic, and event delivery recoverable. Minimize extra requests, use scoped query keys/invalidation, and use a reliable event or bounded polling path for prompt updates. Never expose room QR secrets or another guest's stay.

Coordinate API shapes in packages/contracts/openapi/vesper.json and typed callers. For each changed journey, test success, failure/retry, duplicate submission, reload, and an unauthorized property/department/stay. Run relevant pytest, TypeScript checking and production build. Report files changed, migrations, APIs, checks actually run, and remaining blockers. Do not delete data or deploy as part of this task.
```

## Prompt 1: Guest owner

```text
Own the guest journey under apps/web/app/guest, its shared guest components/API client, and app/api/guest plus guest-safe guest intelligence endpoints. Coordinate shared backend changes before editing them.

First make the real journey work: guest opens a stay-scoped QR/session, sees accurate property/room/amenity/menu availability, submits a service request or food order once, sees persisted status changes, and can give post-service feedback. Staff on another browser must receive the request; checkout must revoke access. Remove the hardcoded room and browser-local request transport if still present. A backend rejection, sold-out item, expired stay or lost connection must show a truthful outcome and safe retry.

Then implement the PDF's guest value only where supported by real data: multilingual concierge with clear escalation to a human; local discovery with verified property/local content; silent-detractor recovery triggered by actual service friction; eco status or targeted spa/F&B offer only when real capacity and consent/eligibility exist. Keep AI advisory and show a deterministic fallback when its provider is unavailable. Do not reveal internal attendance, budgets, employee scores or other stays.

Acceptance: separate guest and staff browser sessions complete request -> assignment -> completion -> guest status; sold-out dishes cannot be ordered; duplicate taps create one order; an expired or different stay cannot read it; after reload the same persisted status appears. Deliver a short API and screen trace for this journey.
```

## Prompt 2: Staff owner

```text
Own apps/web/app/staff, relevant staff API clients, and app/api/staff/workforce operational paths. Coordinate any shared request, inventory or maintenance contract before changing it.

Build a mobile-first work queue sourced from the backend: my assigned tasks, urgency/SLA, room and guest-safe context, start/complete, attendance and breaks, issue/repair reporting, and permitted supply requests. Managers assign incoming work to eligible staff. A staff member sees only their property, department and assignments. Use the same persisted task/status model the guest and manager tracks consume. Make assignment conflicts and offline/error states explicit. Avoid exposing guest private data beyond task need.

Implement the PDF transitions: repair completion should trigger the room Ready transition through a verified state machine; stock-out creates a runner task; a manager-approved ripple plan fans out into the right departments without duplicate tasks. Voice-to-work-order/translation can be added after the typed core works and must produce a reviewable draft before submission.

Acceptance: an order/request submitted in a separate guest browser arrives in the manager's department queue; the manager assigns it to staff, who starts and completes it; guest and manager see the result after reload. Staff can clock in/out and submit a real shortage/defect report. Verify forbidden access to another department/property and preserve an audit trail for state changes.
```

## Prompt 3: Manager and GM owner

```text
Own apps/web/app/admin and manager-facing API clients, plus the relevant scoped backend overview/action/frontdesk/inventory/maintenance services. Coordinate shared data models before editing them.

Make manager and GM workspaces truly role-specific. Department managers see only assigned departments: demand-aware attendance/coverage, staff assignment, arrivals/room readiness where authorized, defects/OOO dispatch, requests and SLA, stock and requisitions, routine approvals and budget consumption. GM sees an all-department selector, property totals with data freshness, 14-day forecast when grounded in actual data, exception radar, guest satisfaction, RevPAR/ADR/occupancy, a concise morning briefing and auditable high-impact approvals. Do not present missing data as zero or model output as certainty. Do not grant a manager another department via a URL/filter.

Prioritize these PDF loops: attendance gap -> coverage recommendation; repair complete -> Ready -> check-in; zero ingredient -> runner + PO draft + sold-out guest menu; disruption -> one GM-reviewed ripple plan with department tasks and measurable outcomes. An approval must execute once under retries/concurrency. Department purchasing follows the confirmed role policy; GM sees spend and approves only actions explicitly assigned to GM. If requisition/budget contracts are absent, build those persisted contracts before making the UI appear complete.

Declutter the operator UI after checking real references: remove standalone model-performance and model-settings pages, standalone rate simulator, standalone loyalty accounting, duplicated reports and micro-telemetry; retain guest VIP/profile history, direct rate recommendations, standard reports and any backend engines still needed by live workflows. Do not delete a service because its dashboard disappeared.

Acceptance: GM selector changes backend-scoped metrics; manager cannot fetch another department's records; OOO repair and stock-out chains update the guest and staff screens; one approved ripple creates exactly the intended tasks; forecast/briefing identify source period and fallback; approval retries have one side effect.
```

## Prompt 4: Integration, speed and cleanup owner (run after role branches merge)

```text
Integrate the three tracks into one connected release candidate. Resolve schema/contract conflicts and migration order. Fix the concrete P1 issues still present in docs/project-review-2026-09-24.md before calling the product usable: deployed authentication/QR authorization, fresh migrations, property/department/stay isolation, lost operational events, concurrent room assignment and duplicate approvals. Verify current code first; the review is a dated source inspection.

Run a clean database migration and an upgrade on representative existing data. Exercise in separate browser sessions: guest order -> staff completion -> inventory deduction -> manager exception -> guest status/feedback; repair -> Ready -> check-in; zero ingredient -> runner + PO -> manager/GM approval according to policy -> sold-out menu; attendance gap -> manager action; one ripple plan -> multiple departments. Check failure/retry, same action twice, server restart, disconnected Redis, a second department and a second property. Record measured request-to-visible-update latency and fix slow paths; do not invent a performance number. Run pytest, TypeScript, build, OpenAPI export/validation and browser checks. Keep source-of-truth results after reload.

For cleanup, inventory imports and routes before deletion. Remove links, permissions and route references to abandoned operator pages; preserve shared logic that active flows use. Use the PowerShell commands below only after the reference check is empty. Delete unused demo files only after every application import has been removed. Do not delete database rows, migrations, engines used by live endpoints, or test fixtures needed by tests. Show the exact deletion diff and rerun checks.
```

### PowerShell cleanup commands (run from repository root after integration)

```powershell
# Audit references first. Results require inspection; a match may be a legitimate dependency.
rg -n '(/admin/(simulator|model-performance|model-settings|loyalty)|lib/demo|DEMO_USERS|DEMO_PROPERTY)' apps/web/app apps/web/components apps/web/lib
rg -n 'simulator|model.performance|model.settings|loyalty' app packages tests scripts

# After links/imports are removed and the routes are confirmed unused, remove only these UI routes.
git rm -- apps/web/app/admin/simulator/page.tsx apps/web/app/admin/model-performance/page.tsx apps/web/app/admin/model-settings/page.tsx apps/web/app/admin/loyalty/page.tsx

# Delete demo modules individually only after `rg` finds no application import of each one.
# Example: git rm -- apps/web/lib/demo/<verified-unused-file>.ts

git diff --check
git diff --cached --stat
python -m pytest -q
Set-Location apps/web
npx tsc --noEmit
npm run build
```

The four UI routes above currently exist and are referenced by navigation/auth code. Remove those references first. `loyalty_tier` in a guest profile is not standalone loyalty accounting and should remain if used. Do not run broad recursive delete commands against `apps/web/lib/demo` or backend modules without a dependency check.
