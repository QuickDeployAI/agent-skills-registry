---
name: smb-month-end-close
description: Drive a small business's month-end close across QuickBooks, Stripe, Square, and Shopify — pull the period's numbers, reconcile processor totals against the books, flag missing receipts and discrepancies, and produce an owner/accountant review packet — strictly read-only.
license: MIT
metadata:
  "ai.quickdeploy.skills/read-only": "true"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
  "ai.quickdeploy.skills/requires": "quickbooks-bookkeeping,stripe-payments-operator,square-pos-ops,shopify-store-operator"
---

# SMB Month-End Close

Assemble the month-end picture across the books (QuickBooks) and the
money-moving systems (Stripe, Square, Shopify), reconcile them, and hand
the owner/accountant a packet with every discrepancy already surfaced.

This skill is **strictly read-only**: it finds and reports problems. Fixes
(recategorizing, adjusting entries) go through `quickbooks-bookkeeping`'s
confirm-gated flows, initiated by the user.

## Safety

- Read-only: exports, listings, and reports only. Never write back.
- Sandbox/test data by default in every composed system.
- Secrets by environment variable name only, per each composed skill.
- Never force numbers to match: an unexplained difference is a finding,
  not a rounding adjustment.

## Close sequence

### 1. Books status (QuickBooks)

Run the close checklist read-only — note what's incomplete rather than
fixing it:
[../quickbooks-bookkeeping/references/docs-month-end-close-checklist.md](../quickbooks-bookkeeping/references/docs-month-end-close-checklist.md).
Export the period's reports per
[../quickbooks-bookkeeping/references/docs-accountant-handoff.md](../quickbooks-bookkeeping/references/docs-accountant-handoff.md).

### 2. Processor totals

- **Stripe**: period balance transactions — gross, refunds, fees, payouts
  ([../stripe-payments-operator/references/cli-commands.md](../stripe-payments-operator/references/cli-commands.md)).
- **Square**: period payments and refunds
  ([../square-pos-ops/references/api-endpoints.md](../square-pos-ops/references/api-endpoints.md)).
- **Shopify**: period order totals by financial status
  ([../shopify-store-operator/references/graphql-operations.md](../shopify-store-operator/references/graphql-operations.md)).

Skip any system the business doesn't use and note the skip in the packet.

### 3. Reconciliation

Using the transactions export column map
([../quickbooks-bookkeeping/references/export-transactions-export.md](../quickbooks-bookkeeping/references/export-transactions-export.md)):

1. Match each processor payout to a book deposit (date ± 2 business days,
   exact amount).
2. Verify period gross − refunds − fees per processor equals the payouts
   plus the ending processor balance movement.
3. List every unmatched payout, unmatched deposit, and amount difference
   with the raw numbers on both sides.

### 4. Missing-receipt sweep

From the books, list expenses over the receipt threshold with no
attachment, grouped by vendor, with dates and amounts.

## Review packet format

```
MONTH-END CLOSE — <period> (<TEST or LIVE data>)
Books:      <n> checklist items complete / <m> open (list open items)
Stripe:     gross / refunds / fees / payouts — matched to books? Y/N
Square:     gross / refunds / fees / payouts — matched to books? Y/N
Shopify:    orders gross by status — matched? Y/N (or SKIPPED: not used)
Discrepancies: <n> items, each with both sides' numbers
Missing receipts: <n> expenses, total <amount>
Open questions for accountant: <list>
```

Deliver the packet plus the exported report files. Every discrepancy line
must carry enough detail (IDs, dates, amounts) for someone else to resolve
it without re-deriving the data.
