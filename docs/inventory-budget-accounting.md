# Department requisitions and budgets

## Ownership and approval

A staff member submits a requisition for their authenticated property and sole assigned
department. Each line records its stock item, quantity, reason, and unit cost at
submission. The responsible manager is selected from the department's active managers
at submission, preferring its configured head. Only that manager, while still assigned
to the department, may approve or reject it. Decisions and reasons are stored on the
request and appended to its audit history. Repeating the same decision is idempotent;
a conflicting later decision is rejected.

Approval creates one approved purchase order per line in the same transaction. The
unique request-line link prevents duplicate conversion. Each PO and resulting stock
movement snapshots the requisition department. Reassigning the stock item later does
not transfer the order or its budget charge. Managers see POs for their assigned
departments; the GM and internal service principals need explicit `purchase:read`
permission for property-wide oversight. Requisition approval has its own permission
and does not require AI dashboard or action-card access.

## Accounting rules

Budgets are inclusive date periods for one department, property, and currency. Periods
for the same department and currency cannot overlap. The currency must equal the
property currency because item costs have no foreign-exchange rate. Approval uses the
budget active on that day and retains its budget ID even after the period ends.

- **Allocated** is the GM's budget amount for the period.
- **Committed** is the unreceived cost of approved, ordered, or partially received POs
  linked to that budget. For each PO it is `total_cost - rounded(gross_received ×
  unit_cost)`. Cancelled and fully received orders have no remaining commitment.
- **Spent** is `rounded((gross_received - returned) × unit_cost)` for each linked PO,
  including cancelled orders that were partly received.
- **Remaining** is `allocated - committed - spent`. Approval fails if the proposed
  commitment exceeds this value. Allocation cannot be reduced below committed plus
  spent. Money is rounded to cents with half-up rounding per PO.

Receiving part of an order moves its value from committed to spent. Cancelling a
partly received order releases only the unreceived commitment. A return uses a
negative stock movement and reduces spent; it never reverses more than the net
received quantity. Receipt and return operation IDs are unique per PO, so retries do
not move stock or charge the budget twice. PO, budget, and stock item row locks
serialize concurrent updates. The legacy no-body receipt endpoint receives the full
remaining quantity with a stable operation ID.

Existing POs and movements have their department backfilled from the stock item's
assignment at migration time, which is the only available historical ownership
evidence. Existing POs have no budget link and do not retroactively consume a new
allocation. New PO approvals require an active budget.
