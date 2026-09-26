# Vesper workflow review and connected demo

## Assessment (26 September 2026)

**Overall: 7/10 for a hackathon demo; 5/10 for an unattended real resort rollout.** This is a code and workflow assessment, not a field usability study. The repo has functioning role boundaries, guest QR stays, staff tasks, front desk and housekeeping boards, inventory and purchase approval, action cards with human approval and undo, and manager dashboards. The base seed supplies rooms, people, bookings, menu, stock and forecast history. It did not give reviewers a short path through an entire incident, and a number of sophisticated views depend on a running database and event workers that were unavailable during this review.

| Journey | Current strength | Friction for a human user | Best next improvement |
| --- | --- | --- | --- |
| Guest request → staff → manager | Request and task models share a source reference; overdue counts reach the GM overview | A reviewer must switch pages to understand who owns the guest outcome | Add a single request timeline with assignee, SLA clock, last update, and one escalation action |
| Issue → maintenance | Issue, work order and task can be linked | Occupied room safety and room move decisions require human judgement | Show a room impact panel and require front desk acknowledgement before taking an occupied room out of service |
| Low stock → menu → purchase | Menu availability checks recipe stock and purchases require approval | The relationship is hard to see across guest menu, inventory and action queue | Add a dependency view: unavailable item → ingredient → days to replenishment → approval owner |
| Leave → roster | Leave and roster gap concepts exist | Draft roster gaps can be missed during shift handover | Put uncovered shifts and proposed substitutes at the top of the manager day view |
| GM oversight | Live department aggregates and action queue exist | Plain counts hide which department is falling behind | Show proportional workload bars and overdue segments, sorted by overdue work (implemented) |

## Connected scenario seed

The original `scripts/seed.py` creates the synthetic resort, including demo accounts and at least three active stays. The add-on `scripts/seed_workflow.py` creates the five journeys above, using stable IDs so rerunning it skips existing rows. It is restricted to the synthetic resort and its `gm@vesper.demo` account. Preview makes no writes. It never deletes data or resets schemas.

```powershell
python scripts/seed_workflow.py --list-properties
python scripts/seed_workflow.py --property-id YOUR-PROPERTY-UUID
python scripts/seed_workflow.py --property-id YOUR-PROPERTY-UUID --apply
```

Use the existing demo password from `scripts/seed.py` only in a local demo. Do not expose this seeded property to real guests or copy the synthetic records into production. The new data includes a rule-origin purchase recommendation; it is labelled by its inventory engine and still needs a manager's approval. No generated text is presented as a verified AI judgement.

**Suggested walkthrough:** Log in as the guest of an in-house room and inspect a request; use `hk1@vesper.demo` to inspect assigned and completed tasks; use `chiefeng@vesper.demo` to inspect the AC task; use `chef@vesper.demo` to inspect the inventory request and unavailable dessert; use `gm@vesper.demo` to compare department load, review the linked issue and purchase card, and decide whether to approve the purchase. Do not approve just to make the screen green: check the supplier, cost, budget and expiry first.

## Product changes to prioritise next

1. **One incident timeline across roles.** Preserve guest friendly status text but show staff and managers the same request ID, assignee, SLA, last action and escalation. This removes page hopping and helps the next shift continue a case.
2. **Use AI to draft, humans to decide.** Summarise a request, classify the correct department, detect likely duplicate issues, and propose a reply. Show source messages, confidence and the next human action. Never auto-close complaints, move an occupied guest, or approve spending from a model output.
3. **Make the day view exception first.** Put overdue guest promises, rooms that cannot be sold, unfilled shifts and blocked menu items above forecast charts. Each exception should link to a concrete owner and a resolving action.
4. **Measure outcomes, not clicks.** Track request time to acknowledgement, time to delivery, reopen rate, room downtime, purchase lead time, staffing coverage and guest rating after resolution. Compare by department and shift, with denominators and date range visible.
5. **Run a real operational pilot.** Test with one manager and one employee from each department during a shift. Time their common tasks and observe where they leave the product for phone or WhatsApp. Simplify those steps before adding more automation.

The seeded incidents intentionally remain open or draft where a human decision is still needed. That makes the approval and handover paths testable rather than showing an artificially perfect dashboard.
