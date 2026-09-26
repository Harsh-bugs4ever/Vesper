# Phase 5 frontend API dependencies and unavailable contracts

Current backend contracts used by the Phase 5 UI:

- `GET /property/departments` returns authorized `{id,key,name,...}[]`.
- `GET /property` supplies the backend currency. The frontend does not assume INR.
- `GET /inventory/items` returns property/department-scoped stock item details. `GET /inventory/summary` returns scoped totals, low/expiring counts and stock value. Both require `stock:read`.
- `GET /purchase-orders` returns backend-scoped orders and requires `stock:read`. `POST /purchase-orders/{id}/approve` accepts `{}` or an optional `{quantity}` and requires `purchase:approve`. `POST /purchase-orders/{id}/receive` requires `stock:write`. The UI only reports success after these calls succeed and invalidates procurement queries.

Required missing contracts:

1. Staff supply requests: `POST /inventory/requisitions` with `{department_id, items:[{item_id,quantity}], reason}` and a persisted response including `id`, `requester_id`, `requester_name`, `department_id`, requested items/quantities, reason, status, timestamps and version. `GET /inventory/requisitions/mine` must return only the authenticated requester's persisted requests. The backend should grant eligible Staff a scoped catalogue read permission; default Staff currently lacks `stock:read`. The request action and My Requests list remain unavailable.
2. Manager decisions: `GET /inventory/requisitions?department_id=uuid&status=pending` must return only authorized department records with requester, item names/units/quantities, reason and decision history. `POST /inventory/requisitions/{id}/approve` should persist a decision and return the updated requisition plus linked PO if created. `POST /inventory/requisitions/{id}/reject` must require `{reason}` and return the persisted rejection. Both need conflict/version handling. The rejection control remains unavailable; PO cancellation is not presented as requisition rejection.
3. Department budget: `GET /budgets?period=YYYY-MM&department_id=uuid` should return per authorized department `{department_id,period,currency,allocated,committed,spent,remaining,as_of}` with nullable fields when the ledger is incomplete. These values must be calculated by the backend. The GM budget screen shows unavailable values until this endpoint exists.
4. Rich PO detail: the present `PurchaseOrderOut` has `status`, `approved_at`, `received_at` and `rationale`, but lacks `department_id`, requester, requisition link, decision history, approver, rejection reason, and receipt detail. Add those fields or a scoped `GET /purchase-orders/{id}` response. The frontend currently shows only verified fields.
5. Department filtering: `StockItemOut` and `PurchaseOrderOut` omit `department_id`; their list routes are backend-scoped, but the GM cannot filter them by department. Include `department_id` and accept a validated department filter if that view is required.

The full staff submission → manager decision → PO → receipt → GM budget sequence cannot be verified or completed with the current backend: requisition and budget endpoints are absent. The UI does not generate sample records or infer missing budget values.
