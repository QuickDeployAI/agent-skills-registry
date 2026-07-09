---
name: smb-collections-followup
description: Chase overdue receivables across Stripe and QuickBooks — build the aging picture, draft payment reminders, and prepare escalations — with every outbound send and payment retry confirm-gated.
license: MIT
metadata:
  "ai.quickdeploy.skills/read-only": "false"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
  "ai.quickdeploy.skills/destructive-ops": "send-reminder,retry-payment"
  "ai.quickdeploy.skills/requires": "stripe-payments-operator,quickbooks-bookkeeping"
---

# SMB Collections Follow-up

Turn overdue receivables into a worked queue: who owes what, how late, what
was already tried, and what goes out next. Reading is free; anything that
reaches a customer (reminder email, payment retry) is destructive and
requires explicit confirmation per send.

## Safety

- **Confirm every outbound touch.** Show the recipient, invoice(s), amount,
  and the exact message text; get confirmation per customer — a blanket
  "chase everyone" instruction is not sufficient for an individual send.
- **Tone guardrail:** reminders stay factual and polite through all stages;
  escalation language only at stage 3+, and legal threats never — that's
  the owner's call, offline.
- Sandbox data (Stripe test mode, QBO sandbox company) by default.
- Secrets by environment variable name only.

## Building the aging picture

1. **QuickBooks**: pull the A/R aging (see the invoice export column map:
   [../quickbooks-bookkeeping/references/export-invoice-export.md](../quickbooks-bookkeeping/references/export-invoice-export.md)).
   Validate rows per the map's rules before trusting totals.
2. **Stripe**: list failed/unpaid payment intents and past-due
   subscriptions (commands in
   [../stripe-payments-operator/references/cli-commands.md](../stripe-payments-operator/references/cli-commands.md)).
3. Merge by customer; classify into buckets: 1–15, 16–30, 31–60, 60+ days.

## Reminder ladder

| Stage | Trigger | Action (drafted, confirm before send) |
| --- | --- | --- |
| 1 | 1–15 days late | friendly nudge with invoice link and amount |
| 2 | 16–30 days | second notice; offer payment plan if amount > typical invoice |
| 3 | 31–60 days | firm notice; copy the owner; propose a call |
| 4 | 60+ days | escalation summary for the owner: history, attempts, recommended next step |

For card-payment failures, a **payment retry** (via the Stripe operator's
confirm-gated flow) may replace a stage-1 reminder when the failure code is
retryable (`insufficient_funds`, `try_again_later`) — never for
`stolen_card` or hard declines.

## Weekly collections report

Buckets with counts and totals, top five debtors, stage movements since
last week, and expected collections this week. Numbers first; every
recommended action listed with its stage and draft attached.
