# Live workflow verification · 27 September 2026

The seeded JW Marriott Mumbai property is simulated and unaffiliated with Marriott. The demo database was neither reset nor replaced.

## Observed on the local stack

- PostgreSQL and Redis passed `/ready`; the frontend returned HTTP 200.
- Guest QR session, room and live menu loaded. A housekeeping request reached staff, was claimed and completed, appeared delivered to the guest, and accepted a rating. A staff report was submitted and approved by its category manager.
- A room-service order with a recipe reached F&B staff, was claimed and completed. The guest tracker showed delivery, and the linked ingredient quantity decreased. A room issue created or merged into an issue with a linked maintenance work order.
- GM overview, action queue and a 14-day F&B digital twin with rain and heat scenario parameters returned data. Category manager inventory and purchase-order lists and staff attendance history loaded. Spending approval, roster changes and attendance check-in were not exercised in this live pass.
- The full Python suite, strict TypeScript check and production build passed. Browser inventory exposed no permitted browser surface, so no desktop or phone visual inspection occurred.

Observed local API timings varied under concurrent checks. Typical inventory and purchase list reads were 33–58 ms, guest room/menu reads 50–218 ms, guest writes 89–389 ms, and GM overview 180–232 ms. The weather twin took 4.6–7.9 seconds cold; one concurrent guest order took 6.7 seconds. These outliers need performance work before a hotel pilot.

## Product judgement

Hackathon demo: **7/10**. The core request, task, stock and manager handoff is real and testable. Real hotel readiness: **4/10**. Payment is an explicitly unpaid demo order without gateway or PMS settlement, browser usability is unverified in this session, some staffing and weather behavior relies on assumptions, and external feeds can slow the GM view. Nugen alignment is blocked by upstream HTTP 502; no aligned model is deployed.

Next automation work should start with evidence and a human owner: classify complaints from guest text with confidence and manager override; assign staff from actual shifts, availability and workload; alert owners before measured SLA deadlines and send guests accurate delay updates; warn of recipe shortages using live stock, booking demand and lead times. Preserve manager approval for purchases, compensation and occupied-room decisions. Show the source, sample size or rule, and uncertainty for each recommendation.
