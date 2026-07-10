# Safety and confirmation protocol

This skill can move money. These rules are not optional.

## Destructive operations

Exactly two operations in this skill are destructive:

1. `refund-payment` — creates a refund against a captured charge.
2. `cancel-subscription` — cancels or schedules cancellation of a
   subscription.

## Summarize-then-confirm

Before executing either operation:

1. **Retrieve current state** of the target object (charge, subscription).
2. **Summarize the exact change** to the user in plain language: object IDs,
   amounts and currency, the customer affected, timing, and whether the
   action is reversible.
3. **Wait for explicit confirmation** of that specific summary. A general
   instruction earlier in the conversation ("clean up the failed
   subscriptions") is not sufficient for an individual money-moving call.
4. Execute, then **report the result** (new object IDs and final state).

If anything about the target looks different from what the user described
(different amount, different customer), stop and surface the discrepancy
instead of proceeding.

## Secrets

- Reference credentials only by environment variable name:
  `STRIPE_API_KEY`, optionally `STRIPE_LIVE_MODE`.
- Never print, log, or paste key material, even partially masked.
- Never write keys into files, commit messages, or generated reports.

## Blast-radius limits

- One destructive operation per confirmation — never batch refunds or
  cancellations under a single confirmation.
- No bulk operations (loops over customers/charges) without the user
  approving the full list of affected objects first.
