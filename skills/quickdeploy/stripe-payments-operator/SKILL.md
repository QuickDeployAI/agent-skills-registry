---
name: stripe-payments-operator
description: Operate Stripe payments from an agent with sandbox-safe defaults — inspect payments, customers, subscriptions, and webhooks via the Stripe CLI/API, and only touch money-moving operations with explicit confirmation.
license: MIT
metadata:
  "ai.quickdeploy.skills/read-only": "false"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
  "ai.quickdeploy.skills/destructive-ops": "refund-payment,cancel-subscription"
---

# Stripe Payments Operator

Operate a small business's Stripe account safely: look up payments and
customers, inspect subscriptions, test webhooks, and prepare reconciliation
handoffs. Money-moving operations (refunds, subscription cancellation) are
destructive and require explicit user confirmation every time.

## Safety

- **Sandbox first.** Default to Stripe test mode (`sk_test_*` keys, `stripe
  --api-key "$STRIPE_API_KEY"` with a test key). Only operate on live data
  when the user explicitly asks and confirms, and say so before each live
  call. See [references/sandbox-vs-production.md](references/sandbox-vs-production.md).
- **Secrets by name only.** Reference credentials strictly by environment
  variable name (`STRIPE_API_KEY`); never echo, log, or inline key values.
- **Destructive operations require explicit confirmation.** Before
  `refund-payment` or `cancel-subscription`, summarize exactly what will
  change (object IDs, amounts, customer) and wait for the user to confirm.
  See [references/safety-and-confirmation.md](references/safety-and-confirmation.md).
- Everything else in this skill is read-only inspection and reporting.

## Requirements

- Stripe CLI (`stripe`) installed and authenticated, or API access via
  `STRIPE_API_KEY`.
- Optional `STRIPE_LIVE_MODE=1` as the explicit opt-in gate for live-mode
  operations.

## Workflows

### Inspect recent payments

1. `stripe payment_intents list --limit 10` — recent payment intents.
2. For a specific charge: `stripe charges retrieve <ch_...>`.
3. Summarize status, amount, customer, and failure codes for the user.

### Investigate a failed payment

1. Locate the payment intent (`stripe payment_intents list` or by ID).
2. Check `last_payment_error` and the attached customer's default payment
   method.
3. Report the failure reason and suggest the follow-up (retry, new card,
   dunning email) — do not act without being asked.

### Inspect customers and subscriptions

1. `stripe customers list --limit 10` / `stripe customers retrieve <cus_...>`.
2. `stripe subscriptions list --customer <cus_...>` for billing state.
3. Never modify billing without the confirmation flow below.

### Test webhooks (sandbox only)

1. `stripe listen --forward-to localhost:<port>/webhook` in test mode.
2. `stripe trigger payment_intent.succeeded` (or another event) to exercise
   handlers.
3. Report delivered events and handler responses. Details in
   [references/stripe-cli.md](references/stripe-cli.md).

### Refund a payment (destructive — confirm first)

1. Retrieve the charge/payment intent and present: amount, currency,
   customer, date, and any prior refunds.
2. Ask the user to confirm the exact refund (full or partial amount).
3. Only after explicit confirmation: `stripe refunds create --charge <ch_...>
   [--amount <cents>]`.
4. Report the refund ID and status.

### Cancel a subscription (destructive — confirm first)

1. Retrieve the subscription and present: plan, price, current period end,
   and proration implications.
2. Ask the user to confirm cancellation timing (immediately vs period end).
3. Only after explicit confirmation: `stripe subscriptions cancel <sub_...>`
   (or `update --cancel-at-period-end true`).
4. Report the resulting subscription state.

### Reconciliation handoff

1. Export the period's balance transactions:
   `stripe balance_transactions list --limit 100` (page as needed).
2. Summarize gross, fees, net, and payout timing.
3. Hand the summary to the bookkeeper/accountant workflow — this skill does
   not write to any accounting system.
