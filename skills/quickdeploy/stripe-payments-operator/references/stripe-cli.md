# Stripe CLI reference

Working subset of Stripe CLI commands this skill uses. Full docs:
https://docs.stripe.com/stripe-cli

## Authentication

- Interactive: `stripe login` (browser pairing).
- Headless/CI: pass `--api-key "$STRIPE_API_KEY"` per command. Never inline a
  literal key.
- Test vs live is determined by the key prefix (`sk_test_*` vs `sk_live_*`).
  This skill assumes test keys unless the user explicitly opts into live mode.

## Read-only inspection

| Purpose | Command |
| --- | --- |
| Recent payment intents | `stripe payment_intents list --limit 10` |
| One payment intent | `stripe payment_intents retrieve <pi_...>` |
| One charge | `stripe charges retrieve <ch_...>` |
| Customers | `stripe customers list --limit 10` |
| One customer | `stripe customers retrieve <cus_...>` |
| Customer subscriptions | `stripe subscriptions list --customer <cus_...>` |
| Balance | `stripe balance retrieve` |
| Balance transactions (reconciliation) | `stripe balance_transactions list --limit 100` |
| Payouts | `stripe payouts list --limit 10` |
| Recent events | `stripe events list --limit 20` |

All list commands accept `--starting-after <id>` for pagination and emit
JSON — parse rather than scrape.

## Webhook testing (test mode only)

- `stripe listen --forward-to localhost:<port>/webhook` — forwards test-mode
  events to a local handler and prints the webhook signing secret.
- `stripe trigger <event>` — fires a fixture event, e.g.
  `payment_intent.succeeded`, `invoice.payment_failed`,
  `customer.subscription.deleted`.
- `stripe events resend <evt_...>` — redeliver a specific event.

## Destructive commands (explicit confirmation required)

| Operation | Command |
| --- | --- |
| Full refund | `stripe refunds create --charge <ch_...>` |
| Partial refund | `stripe refunds create --charge <ch_...> --amount <cents>` |
| Cancel subscription now | `stripe subscriptions cancel <sub_...>` |
| Cancel at period end | `stripe subscriptions update <sub_...> --cancel-at-period-end true` |

Follow the confirmation protocol in
[safety-and-confirmation.md](safety-and-confirmation.md) before any of these.
