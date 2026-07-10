---
name: square-pos-ops
description: Operate Square POS back-office work against the sandbox by default — payments review, order lookup, catalog and inventory checks, customer lists — with refunds as the only confirm-gated write.
license: MIT
metadata:
  "ai.quickdeploy.skills/read-only": "false"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
  "ai.quickdeploy.skills/destructive-ops": "refund-payment"
---

# Square POS Ops

Back-office operations for a Square seller: review payments, look up
orders and fulfillment state, spot-check catalog and inventory, and list
customers. The only write in this skill is refunding a payment, and it is
confirm-gated every time.

## Safety

- **Sandbox first.** Square provides a full sandbox (separate tokens,
  `connect.squareupsandbox.com`); operate there unless the user explicitly
  opts into production (`SQUARE_PRODUCTION=1`).
- **Refunds are destructive.** Present payment ID, amount, currency, and
  customer; get explicit confirmation per refund; then check the refund
  status in the response.
- Secrets by environment variable name only (`SQUARE_ACCESS_TOKEN`).
- Page with `cursor`/`limit`; never fetch unbounded lists.

## Endpoints

Generated endpoint shapes: [references/api-endpoints.md](references/api-endpoints.md).
Base URL: `https://connect.squareupsandbox.com` (sandbox, default) or
`https://connect.squareup.com` (production, explicit opt-in). Auth header
`Authorization: Bearer $SQUARE_ACCESS_TOKEN`.

## Workflows

### Daily payments review (read)

1. `GET /v2/payments` with `begin_time`/`end_time` covering yesterday.
2. Summarize count, gross, fees, and any payments with unusual status
   (`FAILED`, `CANCELED`).
3. Feed totals to the cashflow pulse or month-end close as needed.

### Order lookup (read)

`GET /v2/orders/{order_id}` for a specific order's line items and
fulfillment state. Orders come from receipts, the seller dashboard, or a
payment's `order_id`.

### Catalog and inventory spot-check (read)

1. `GET /v2/catalog/list?types=ITEM,ITEM_VARIATION` — page the catalog.
2. `GET /v2/inventory/counts/{catalog_object_id}` for the variations the
   user cares about; flag zero/negative counts.

### Customer list (read)

`GET /v2/customers` sorted by `CREATED_AT` for recent signups; never export
personal data beyond what the user asked for.

### Refund a payment (write — confirm first)

1. `GET /v2/payments/{payment_id}` — verify amount, status `COMPLETED`,
   and prior refunds.
2. Summarize the exact refund (full/partial, amount, customer) and wait
   for explicit confirmation.
3. `POST /v2/refunds` with an idempotency key; report the refund ID and
   status. One refund per confirmation — no batches.
