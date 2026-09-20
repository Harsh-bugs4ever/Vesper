# API contracts

`openapi/vesper.json` is the generated OpenAPI 3.1 spec for the whole API. It is
generated from the running code, so it is never out of date with it:

```bash
make contracts
```

There were thirteen specs here, one per service; they described a deployment that no
longer exists and `make contracts` removes any that are left behind.

Everything below is served by one application at **`http://localhost:8000`**, which is
the only address the frontend needs.

---

## Authentication

```
POST /auth/login      { email, password }  ->  { access_token, refresh_token, expires_in }
POST /auth/refresh    { refresh_token }    ->  a new pair (the old refresh token dies)
POST /auth/logout     { refresh_token }    ->  204
GET  /auth/me                              ->  the signed-in user + their permissions
```

Send `Authorization: Bearer <access_token>` on everything else. The access token already
carries `role`, `dept` and the full `perms` list, so the UI can decide what to render
without a second call — `GET /auth/me` is there for a page refresh.

Demo accounts (password `vesper123` for all):

| Email | Role | Sees |
|---|---|---|
| `owner@vesper.demo` | owner | everything, including shadow mode and the permission matrix |
| `gm@vesper.demo` | gm | rates, offers, simulator, learning, audit |
| `fom@vesper.demo` | manager | front office |
| `exec@vesper.demo` | manager | housekeeping |
| `chef@vesper.demo` | manager | F&B |
| `hk1@vesper.demo` | employee | the staff app only |

## Errors

Every failure has the same shape, so one handler covers the whole app:

```json
{ "error": { "code": "conflict", "message": "Another manager is holding this card", "details": {} } }
```

`code` is one of `not_found`, `conflict`, `forbidden`, `invalid`, `http_error` and
`rate_limited`. **Show `message` directly** — they are written for the person reading the
screen, not for a log.

(`upstream_timeout` and `upstream_unavailable` are gone. They were the gateway's way of
saying it could not reach a service behind it, and there is nothing behind anything any
more — a handler that fails now fails as itself.)

## The guest QR flow

No login. The nightstand QR encodes `property_id`, `room_id` and a secret:

```
POST /guest/session   { property_id, room_id, qr_secret }
      -> { token, room_number, property_name, guest_name, stay_id, expires_in }
```

That token is a normal bearer token, scoped to one stay. It stops working the moment the
guest checks out, because the room's secret is rotated then. With it:

```
GET  /guest/menu                        the room-service menu, grouped by category
POST /guest/requests                    { kind, note, items: [{menu_item_id, quantity}] }
GET  /guest/requests                    the live tracker
POST /guest/requests/{id}/rating        { rating: 1-5, comment }
POST /guest/issues                      report a problem in this room
POST /guest-intel/concierge/ask         { question } -> { answer, sources[], escalated }
```

## Live updates

```
WS /live?token=<access_token>
```

The token goes in the query string because a browser cannot set headers on a WebSocket
handshake; it is validated the same way. On connect you get
`{ type: "backlog", events: [...] }` with the last 25 events, then one message per event:

```json
{ "type": "request.raised", "payload": { ... }, "occurred_at": "...", "id": "..." }
```

A socket only ever receives its own property, and a staff socket scoped to a department
only receives that department's traffic. Send any text to get `{"type":"pong"}` back as a
keepalive.

## The action card

The spine of the product. `GET /cards` returns the queue ranked by
`confidence × impact × urgency`, and **cards the signed-in user cannot approve are not
returned at all** — no card in the list ever needs a disabled button.

```
GET  /cards                      the ranked queue
POST /cards/{id}/claim           hold it while you read (auto-released after 10 min)
POST /cards/{id}/approve         { adjustments? }  -> approves AND executes
POST /cards/{id}/undo            within undo_seconds_left
POST /cards/{id}/snooze          { minutes }
POST /cards/{id}/dismiss         { reason, note }
```

Each card carries what the UI needs to render it without interpretation: `drivers[]`
(label, detail, weight) for the reasoning list, `confidence` for the bar, `impact_amount`
in rupees, `urgency`, and `can_undo` / `undo_seconds_left` for the countdown toast.

`payload.editable_fields` lists exactly which fields the adjust modal may offer. Sending
anything else back in `adjustments` is rejected with `invalid` — a manager may retune a
card, not turn it into a different action.

## Where things live

| Area | Prefixes |
|---|---|
| Identity, roles, permission matrix | `/auth`, `/admin` |
| Property, rooms, assets, CSV import | `/property`, `/rooms`, `/assets` |
| Attendance and tasks | `/attendance`, `/tasks` |
| Guest QR, requests, issues, guests | `/guest`, `/requests`, `/issues`, `/guests` |
| Stock and purchase orders | `/inventory`, `/purchase-orders` |
| Bookings, stays, visits | `/bookings`, `/stays`, `/visits` |
| Action queue, learning, audit | `/cards`, `/learning`, `/audit` |
| Forecast, rates, simulator | `/revenue` |
| Asset health and work orders | `/maintenance` |
| Rosters and leave | `/workforce` |
| Guest DNA, sentiment, concierge | `/guest-intel` |
| Outbox | `/notifications` |
| Owner dashboard (one call, 11 tiles) | `/dashboard` |
| Staff reviews of guests | `/guest-reviews`, `/staff-reviews` |

---

## Staff reviews of guests

The mirror of a guest rating the hotel. Staff record how a stay went from their side;
the manager sees one score and a summary on checkout morning.

```
POST /guest-reviews/stays/{stay_id}   { rating: 1-5, comment }   one per person, final
GET  /guest-reviews/mine                                          only your own
GET  /guest-reviews/departing?days=1                              the manager's list, ranked
GET  /guest-reviews/stays/{stay_id}                               summary + every review, attributed
POST /guest-reviews/stays/{stay_id}/consider-reward               raises a card, sends nothing
POST /guest-intel/offers/{offer_id}/send                          refused while they are in-house
```

Four things the UI should respect, because they are enforced server-side and the screens
should not imply otherwise:

- **`score` is null until two people have reviewed.** Show the individual reviews and
  "needs more reviews", not a number. One opinion is not a rating.
- **`score` is not the average.** It is a Bayesian average pulled toward the house mean,
  so three fives read lower than twenty fives. `mean_rating` is there too if you want to
  show both; label them differently.
- **`final_score` is the one to rank on.** It is `score` plus a small lift for the guest
  having engaged with us. Guest feedback can only raise it — a complaint is the guest
  handing us information, and counting it against them would punish the same act twice.
- **`guest_sentiment` sits beside the score, never inside it.** A guest who rated us two
  stars is a retention question, not a bad guest. Show it as context.
- **`possible_retaliation` means stop.** This guest complained and staff scored them low.
  It may be fair; it may be payback. The reward path refuses to auto-propose on it, and
  the UI should push the manager to the individual reviews rather than the number.
- **`is_conflicted` on a review** means that reviewer's department is one this guest
  complained about. Show it next to the review. It is deliberately not filtered out.
- **Nothing here is reachable from a guest token** and nothing is ever shown to the
  guest. A 403 on these paths with a QR session is correct, not a bug.

**Staff get something back.** `GET /guest-reviews/service-notes/stays/{stay_id}` is what
the person about to knock on the door should know — preferences and what colleagues
noticed last time. It deliberately carries **no ratings and no attribution**: a note
guides, a score judges, and a housekeeper who knows the guest was marked a 2 treats them
like a 2. Nothing from a review by a department the guest complained about is passed on.

This is the half that makes the other half survive. A review flow that only takes gets
abandoned by week three.

**Ratings are corrected for how hard each reviewer marks.** Some people rate everyone a
3. That is a fact about the reviewer, not the guest, and until it is accounted for the
guest pays for which shift happened to be on. The stored rating is never rewritten — the
adjustment happens at aggregation and is reported in `reasons`, and reviewers far from
the house average are surfaced for a manager rather than silently corrected.

**The coupon size is computed, not typed in.** `payload.discount_pct` on a thank-you card
is set by two separate questions: how well regarded the stay was decides *whether* there
is a coupon at all, and how likely the guest is to drift away decides *how much*.

| Score | Regular guest | Drifting away |
|---|---|---|
| below 3.6 | nothing | nothing |
| 3.6 – 4.19 | 10% | 15% |
| 4.2 and above | 15% | 20% |

Three out of five earns nothing on purpose: it is the midpoint of the scale, so a
threshold there would reward most stays, and a discount most guests receive is a price
cut rather than a thank-you. The manager can still adjust `discount_pct` on the card —
it is in `editable_fields` — but the default is reasoned and shown in the drivers.

**The perk is not always a percentage.** `payload.perk_description` is drawn from what
Guest DNA knows the guest actually likes — breakfast for the person who ordered it every
morning, a spa treatment for the person who lived at the spa. Same cost, read completely
differently: one says somebody noticed, the other says the accounting department noticed.
`discount_pct` is still there as the fallback and the override.

**Rewards go out after departure.** `/offers/{id}/send` is refused with a 409 while the
guest is still in the building, and delivers by WhatsApp to the number on file. A
thank-you handed over at the desk turns checkout into visible differential treatment —
the guest in the next queue sees who got something. On their phone an hour later it reads
as a thank-you. If front desk cannot be reached the send is held rather than risked.

`summary_method` is `model`, `verbatim` or `empty`. On `verbatim` you are looking at
exactly what staff wrote, stitched together — say so rather than presenting it as a
generated summary.

## Things that run on their own

Some state changes without anyone pressing a button, so the UI should not assume it only
changes in response to a click:

| What | How often | Visible as |
|---|---|---|
| Overdue requests alerted | every minute | `is_overdue` on a request, a new outbox row |
| Outbox retries | every minute | `attempts`/`status` moving on `/notifications/outbox` |
| Stale cards expired, abandoned claims released | every 2 minutes | cards leaving `/cards` |
| Stock expiry badges | hourly | `days_to_expiry` on `/inventory/items` |
| Asset risk sweep | every 6 hours | `/maintenance/health`, new work-order cards |
| Forecast refit + rate cards proposed | twice daily | `/revenue/forecast`, new cards |
| Departing guests' reviewers prompted | every 10 minutes | a task on the reviewer's list |

`GET /dashboard` returns every tile in one call. Tiles that could not be loaded come back
`null` and are listed in `unavailable` — show a dash for those rather than a zero, which
would read as "nothing is wrong" when the truth is "we could not check".

## Two things to agree on

**Role names.** `apps/web/lib/auth.ts` currently uses `general_manager`,
`dept_manager_fb`, `dept_manager_hk`, `system_admin`. The backend issues `owner`, `gm`,
`manager`, `supervisor`, `employee`, `guest`, and a department is a separate `dept` claim
rather than part of the role. Gate UI on **permissions, not role names** —
`perms.includes("rates:approve")` rather than `role === "general_manager"` — and the two
stop needing to match. The full list is `GET /admin/permissions`.

**The demo property.** The sprint PDF describes a 145-room Madh Island resort; the README
describes JW Marriott Juhu with ~355 rooms. The seed follows the README (355 rooms, 180
staff). Say which you want and it is a one-line change in `scripts/seed.py`.
