# Shopify app and token setup

Least-privilege setup for the Admin GraphQL API.

## Custom app (single store — recommended here)

1. In Shopify admin: Settings → Apps and sales channels → Develop apps →
   Create an app.
2. Grant only the Admin API scopes this skill uses:
   - `read_products`, `write_products`
   - `read_orders`, `write_orders`
   - `read_customers`
   - `read_inventory`, `write_inventory`
   - `read_discounts`, `write_discounts`
   Drop any `write_*` scope you don't need — a read-only token makes every
   mutation in this skill a no-op.
3. Install the app to the store and copy the Admin API access token into
   the environment as `SHOPIFY_ADMIN_TOKEN`. Never paste token values
   anywhere.

## Development store

Create a development store from a Shopify Partners account for all
iteration; it behaves like production without real customers. This skill
defaults there — the production shop requires `SHOPIFY_PRODUCTION=1` and an
explicit user request.

## Requests

- Endpoint: `https://$SHOPIFY_SHOP_DOMAIN/admin/api/2025-07/graphql.json`
- Header: `X-Shopify-Access-Token: $SHOPIFY_ADMIN_TOKEN` (by name).
- The API is rate-limited by query cost: keep `first` small, request only
  needed fields, and back off on `THROTTLED` errors.
- Always check `userErrors` in mutation payloads; a `200` response does not
  mean the mutation succeeded.
