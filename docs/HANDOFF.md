# Vesper — session handoff

_Written 20 Sep 2026. Everything below is **uncommitted** working-tree state on `main`._

---

## ⚠️ Read this first: the build is broken

`npx tsc --noEmit` fails with **8 errors, all in one file**: `apps/web/app/admin/inventory/page.tsx`.

**Cause.** I rewrote `apps/web/lib/demo/inventory.ts` to a new shape for the Inventory
redesign, then stopped before updating the page that consumes it.

| Old field (page still uses) | New field (demo data now has) |
| --- | --- |
| `item.id` | `item.sku` |
| `item.lastMovement` | `item.lastUpdated` |
| — | `item.icon` (Lucide component, for the row thumbnail) |
| categories `Food`, `Beds & Furniture` | `Food & Beverage`, `Housekeeping` |

New exports now available: `categoryTint`, `SUPPLIER_FILTERS`, `EXPIRY_WINDOW_DAYS`, `SortKey`.

**You cannot `git checkout` your way out of this** — `apps/web/lib/demo/` is untracked, so
the previous version of that file is not in git history. The only path is forward:
finish the Inventory page against the new data shape (see "Next up" below).

Everything else typechecks. `apps/web/app/admin/housekeeping/page.tsx` and
`app/admin/front-desk/page.tsx` were both completed and verified green before this.

---

## What was done this session

### 1. Merge fix (start of session)
`infra/migrations/versions/0001_initial_schema.py` existed untracked and blocked a pull.
Kept origin's version because the incoming `17ce50d62c3e` migration has
`down_revision = '0001'` and the local file declared `revision = "0001_initial_schema"`,
which would have broken the chain.

### 2. Design system rebuilt to the reference images
14 reference screenshots (`ChatGPT Image Sep 20…`, in Downloads) define a calmer look
than the old code: flat white cards, hairline borders, no gradients, no gold glow, no
`Sparkles` "AI" badges, deeper forest-green accent.

**New shared kit** — `apps/web/components/ui/`:
`panel`, `page-header`, `stat-tile` (two variants: label-first and value-first),
`table`, `filter-chips`, `section-tabs`, `mini-stat`, `drawer`, `period-select`,
`activity-feed`, `status-legend`, `range-meter`, `scenario-slider`, `star-rating`,
`section-placeholder`.

**New charts** — `apps/web/components/charts/`:
`sparkline` (hand-rolled SVG), `occupancy-forecast-chart` (band + optional threshold),
`department-revenue-donut`, `arrivals-departures-chart`, `sensor-trend-chart`,
`risk-gauge`, `staffing-chart`, `sentiment-trend-chart`.
All colours come from `apps/web/lib/chart-theme.ts` — nothing else may define a chart colour.

**Shell** — sidebar rebuilt to the agreed **union IA** (Operations / Revenue / People /
Guests / Property / AI & Analytics), new topbar, footer, hand-drawn `vesper-mark`.

### 3. Screens built (all on `lib/demo/*` fixtures unless noted)

| Route | State |
| --- | --- |
| `/admin` | Dashboard — matches reference |
| `/admin/housekeeping` | **Rebuilt to reference**: 302 rooms, floor grouping, filters, room detail panel with photo, attendant, 6-item checklist |
| `/admin/front-desk` | **Rebuilt to reference**: CSS-grid room-calendar Gantt, 5 tabs, check-in panel with pre-check-in list |
| `/admin/inventory` | ⚠️ **Data rewritten, page not yet updated — the broken file** |
| `/admin/reservations` | Built |
| `/admin/requests` | Built — SLA countdowns, accept/complete with undo |
| `/admin/staff` | Built — attendance + task progress |
| `/admin/maintenance` | Built — 5 tabs, master–detail, risk gauge, sensor chart |
| `/admin/rates` | Built — forecast + rate recommendation + range meter |
| `/admin/roster` | Built — staffing chart, alerts, weekly grid |
| `/admin/guests` | Built — Guest DNA, sentiment trend, at-risk, suggested offer |
| `/admin/guest-chat` | Built — thread with source chips, context rail |
| `/admin/simulator` | Built — three working sliders over a real elasticity model |
| `/admin/model-performance` | Built — engine cards, predicted vs actual, outcomes |
| `/admin/performance` | Built — **wired to the real API**, falls back to fixtures |
| `/guest` | Rebuilt to reference + guest→staff rating, **wired to API** |
| `/staff/reviews` | Built — staff→guest reviews, **wired to API** |
| 15 others | Honest placeholders naming the sprint day they're due |

### 4. Guest ↔ staff review feature (full stack)

**Already existed** (merged at session start): `StaffGuestReview`, `fairness` engine,
`guest_rating` engine, `/guest-reviews/*` routes — staff reviewing guests.

**Built this session** — the missing direction:
- `services/guest-intel-service/app/engines/staff_rating.py` — Bayesian average, 60-day
  recency half-life, **min 4 distinct guests** before any score, complaint-context flagging
- `services/guest-intel-service/app/staff_reviews.py` + `staff_reviews_api.py` — 7 routes
- `models.py` — `GuestStaffReview`, `StaffPerformanceSummary`
- `infra/migrations/versions/0003_guest_staff_reviews.py`
- `services/guest-intel-service/tests/test_staff_rating.py` — **18 tests, all passing**
- `permissions.py` — `STAFF_REVIEW_READ`, `STAFF_REVIEW_READ_OWN`
- `services/guest-service/` — `staff_who_served()` + `GET /guest/served-by`
- `services/api-gateway/app/service.py` — `/staff-reviews` route

**Design rules the code enforces** (not just documents):
one rating per guest per staff member per stay, immutable; a score needs 4 separate
guests; unscored staff come back in a **separate list**, never at the bottom of the
board; there is **no disciplinary output** — the low end says "read the comments" and
stops, and a test asserts no `flag_for_hr` / `bottom_performer` field exists.

### 5. API wiring
- `components/query-provider.tsx` — TanStack Query was installed but never mounted
- `lib/api/performance.ts` — typed bindings for all 10 review routes
- `lib/hooks/use-performance.ts`, `lib/hooks/use-reviews.ts` — API when a session exists,
  fixtures when not. Failed **reads** fall back silently (with a "Demo data" badge);
  failed **writes** do not — the stars clear and the user is told.

### 6. Pre-existing bugs fixed
- 6 demo staff records in `lib/auth.ts` missing `propertyId` / `propertyName`
- `app/api/resort-hero/route.ts` — Node `Buffer` is not a DOM `BodyInit`
- Three endpoints I had invented in an earlier pass and have now corrected to real ones
  (`frontdesk /stays/{id}/served-by` → guest-service; `staff /staff/{id}` →
  `identity /admin/users/{id}`; missing gateway route)
- `python-multipart` declared in `requirements-base.txt` but not installed locally

---

## What needs to be done

### Immediately — unbreak the build
Finish `apps/web/app/admin/inventory/page.tsx` against the new data shape. The reference
image (`ChatGPT Image Sep 20, 2026, 12_56_55 PM.png`) calls for:
- 4 value-first stat tiles (Total Items / Low in Stock / Expiring Soon / Total Value)
- filter bar: search, All Categories, All Statuses, All Suppliers, Export
- table with **row thumbnails** (use `item.icon` + `categoryTint[item.category]`),
  **sortable columns** (`SortKey` is exported for this), low quantities in red,
  status chips, `…` actions menu
- **pagination** — "Showing 1–10 of N" with page numbers

### Then
1. **Run the stack.** Docker Desktop's daemon is down, so the `0003` migration has never
   executed and no HTTP request has ever crossed the wire. Everything about the review
   feature is *static* verification only (imports, OpenAPI schema, `alembic upgrade head
   --sql`). Start Docker → `alembic upgrade head` → exercise `/staff-reviews/*`.
   **This is the highest-value remaining task.**
2. **Wire the rest of the frontend.** Only the review feature talks to the backend;
   every other screen reads `lib/demo/*`. Housekeeping is the best next candidate
   (live status changes, a WebSocket story).
3. **The AI Action Queue is still missing.** The old `/admin` had the full
   approve / adjust / snooze / dismiss / undo flow; the reference dashboard doesn't show
   it, so my rebuild dropped it. It is the Day 6 centrepiece and needs a home —
   dashboard or its own route. **This is a product decision, not a coding one.**
4. **Workforce solver** — `/admin/roster` renders but "Generate Roster" is a toast;
   OR-Tools is not connected.
5. **Old-style screens** — `/login`, `/` (landing), `/admin/settings`, `/admin/users`,
   `/staff` still use the old `Card`/gradient look, with 14 `Sparkles` usages that
   contradict the plan's own "look genuine" rules.
6. **Days 9–10** — shadow mode, CSV import, notification outbox, 3D twin, cold-start
   banners, day simulator, deploy to Vercel/Railway.

---

## Gotchas worth knowing

- **Demo data must stay deterministic.** Pages are server-rendered then hydrated;
  `Math.random()` in fixtures causes hydration mismatches. `lib/demo/housekeeping.ts`
  deals statuses from an exact pool using a co-prime stride (97 vs 302) so the headline
  tiles are computed from the same rooms the grid draws — they cannot disagree.
- **The forecast band is clamped at 100%.** A confidence interval running past 100%
  occupancy claims the model can predict something impossible.
- **Tests:** `python -m pytest -q` from the repo root. All pass.
- **Frontend checks:** `npx tsc --noEmit` and `npm run build` from `apps/web`.
- Reference images are in `C:\Users\harsh\Downloads` (14 files dated 20 Sep 2026).
  Worth copying into `docs/design-refs/` so they survive.
