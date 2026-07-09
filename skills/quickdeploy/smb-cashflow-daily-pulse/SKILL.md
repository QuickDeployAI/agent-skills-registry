---
name: smb-cashflow-daily-pulse
description: Produce a small business's daily cash pulse — balance, payouts, failed payments, receivables/payables, sales, low inventory, and near-term cash risk — strictly read-only across Stripe, QuickBooks, Square, and Shopify.
license: MIT
metadata:
  "ai.quickdeploy.skills/read-only": "true"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
  "ai.quickdeploy.skills/requires": "stripe-payments-operator,quickbooks-bookkeeping,square-pos-ops,shopify-store-operator"
---

# SMB Cashflow Daily Pulse

Produce a short, owner-readable daily cash report. This skill only reads:
it never moves money, never modifies records, and never sends anything on
the owner's behalf.

## Safety

- **Strictly read-only.** If a follow-up action is warranted (retry a
  payment, chase an invoice), recommend it in the report — never perform it
  from this skill.
- Secrets by environment variable name only (`STRIPE_API_KEY`).
- Default to sandbox/test data; production reads require the same explicit
  opt-in documented in
  [../stripe-payments-operator/references/sandbox-vs-production.md](../stripe-payments-operator/references/sandbox-vs-production.md).

## Daily pulse workflow (Stripe)

1. **Balance**: `stripe balance retrieve` — available vs pending, by
   currency.
2. **Payouts**: `stripe payouts list --limit 5` — most recent and next
   expected payout amounts and arrival dates.
3. **Yesterday's activity**: `stripe balance_transactions list --limit 50`
   — gross charges, refunds, fees; compute net.
4. **Payment failures**: `stripe events list --limit 20` filtered to
   `payment_intent.payment_failed` and `invoice.payment_failed` — list each
   failure with customer, amount, and error code.
5. **Subscription churn signals**: `stripe subscriptions list --status past_due`
   — subscriptions at risk this week.

Command details live in the Stripe operator skill this pulse composes:
[../stripe-payments-operator/references/cli-commands.md](../stripe-payments-operator/references/cli-commands.md).

## Report format

Produce a compact digest, always in this order:

```
CASH PULSE — <date> (<mode: TEST or LIVE>)
Balance:    <available> available / <pending> pending
Payouts:    last <amount> on <date>; next expected <date>
Yesterday:  <n> charges, gross <amount>, refunds <amount>, net <amount>
Failures:   <n> failed payments (<total amount at risk>)
  - <customer>: <amount> — <error code>, suggested action
At risk:    <n> past-due subscriptions (<MRR at risk>)
Risk note:  <one sentence: can the business cover the next 7 days?>
```

## Near-term cash risk heuristic

Flag a risk note when any of these hold:

- pending payouts exceed available balance and the next payout is more than
  3 days out;
- failed-payment volume exceeds 5% of yesterday's gross;
- past-due subscription MRR exceeds 10% of monthly recurring revenue.

State which rule fired and the numbers behind it — no vague warnings.

## Composed sections

Each section is read-only, numbers first, recommendations only. Skip any
system the business doesn't use and say so in the report.

### QuickBooks receivables/payables

1. A/R aging summary: open invoice count and total per bucket (procedures
   in [../quickbooks-bookkeeping/references/docs-run-profit-and-loss-and-cash-flow-reports.md](../quickbooks-bookkeeping/references/docs-run-profit-and-loss-and-cash-flow-reports.md)).
2. A/P due in the next 7 days: bill count and total.
3. Flag receivables older than 30 days for the collections skill.

### Square daily sales

`GET /v2/payments` for yesterday: count, gross, refunds, fees
([../square-pos-ops/references/api-endpoints.md](../square-pos-ops/references/api-endpoints.md)).

### Shopify orders and inventory

1. Yesterday's orders and gross by financial status
   ([../shopify-store-operator/references/graphql-operations.md](../shopify-store-operator/references/graphql-operations.md)).
2. Low-inventory list: active products with `totalInventory` at or below
   the shop's reorder threshold.

### Extended risk rules

In addition to the Stripe rules above, flag when A/P due within 7 days
exceeds (available balance + expected payouts within 7 days), and when
low-inventory items include any of the top five sellers.
