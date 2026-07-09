---
name: shopify-store-operator
description: Operate a Shopify store through the Admin GraphQL API against a development store by default — order triage, catalog and inventory checks, discounts, and customers — with every mutation confirm-gated.
license: MIT
metadata:
  "ai.quickdeploy.skills/read-only": "false"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
  "ai.quickdeploy.skills/destructive-ops": "product-update,order-close,discount-create,inventory-adjust"
---

# Shopify Store Operator

Run day-to-day store operations over the **Admin GraphQL API** (the REST
Admin API is deprecated — do not use it). Reads are free; every mutation is
destructive and requires explicit confirmation.

## Safety

- **Development store first.** Operate against a development store unless
  the user explicitly opts into the production shop
  (`SHOPIFY_PRODUCTION=1`) — and say so before each production mutation.
- **Every mutation is confirm-gated.** Follow the safe-operation checklist
  in the generated reference: summarize the exact input, confirm, execute,
  then check `userErrors` and report.
- Secrets by environment variable name only (`SHOPIFY_ADMIN_TOKEN`,
  `SHOPIFY_SHOP_DOMAIN`).
- Use Shopify search syntax to scope reads narrowly; page with `first` —
  never fetch unbounded lists.

## Operations

The generated operation reference is the source of truth for shapes and
checklists: [references/graphql-operations.md](references/graphql-operations.md).
App/token setup: [references/oauth-setup.md](references/oauth-setup.md).

### Order triage (read)

1. `orders(first: 20, query: "fulfillment_status:unfulfilled")` — the open
   queue.
2. For each: financial status, fulfillment status, flag anything paid but
   unfulfilled older than the shop's SLA.
3. Output a triage table with recommended next actions.

### Catalog and inventory checks (read)

1. `products(first: 50, query: "status:active")` — spot-check titles and
   `totalInventory`.
2. Flag active products with zero/negative inventory for the low-stock list.

### Product changes (mutation — confirm first)

`productUpdate` for title/status changes. Summarize before/after values and
the product ID; confirm; check `userErrors`.

### Discounts (mutation — confirm first)

`discountCodeBasicCreate` for simple codes. Confirm code, value, and
duration before creating; report the created code exactly once.

### Closing orders (mutation — confirm first)

`orderClose` only for fully-fulfilled, fully-paid orders; confirm the order
name and status before closing.

### Inventory adjustments (mutation — confirm first)

`inventoryAdjustQuantities` with an explicit `reason`; never adjust to
reconcile a discrepancy you haven't investigated.
