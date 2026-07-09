# Cash pulse report template

Copy this shape exactly; owners read it on a phone in ten seconds.

```
CASH PULSE — 2026-07-09 (TEST)
Balance:    $12,480.20 available / $3,105.00 pending
Payouts:    last $4,912.75 on 2026-07-07; next expected 2026-07-10
Yesterday:  38 charges, gross $5,204.00, refunds $150.00, net $4,872.31
Failures:   2 failed payments ($318.00)
  - Acme Co: $199.00 — card_declined, suggest dunning email
  - J. Smith: $119.00 — expired_card, suggest card-update link
At risk:    3 past-due subscriptions ($447.00 MRR)
Risk note:  OK — available balance covers 7-day average outflow 2.1x.
```

Rules:

- Always state TEST vs LIVE at the top — never mix modes in one report.
- Amounts in the account's settlement currency; two decimals.
- "Failures" lists at most five rows; roll the rest into the count.
- The risk note is exactly one sentence and cites the triggering rule's
  numbers (or says "OK" with the coverage ratio).
- End the report with recommendations only — this skill never executes them.
