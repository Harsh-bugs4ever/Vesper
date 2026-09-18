# API contracts

`openapi/` holds one generated OpenAPI 3.1 spec per service. They are generated from the
running code, so they are never out of date with it:

```bash
make contracts
```

Everything below goes through the gateway at **`http://localhost:8000`**. The frontend
should never call a service port directly — the gateway is what validates the token and
applies rate limits.

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

`code` is one of `not_found`, `conflict`, `forbidden`, `invalid`, `http_error`,
`rate_limited`, `upstream_timeout`, `upstream_unavailable`. **Show `message` directly** —
they are written for the person reading the screen, not for a log.

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

---

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
