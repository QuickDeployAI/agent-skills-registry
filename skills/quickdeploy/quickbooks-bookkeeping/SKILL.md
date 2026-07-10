---
name: quickbooks-bookkeeping
description: Operate QuickBooks Online bookkeeping against a sandbox company by default — bank transaction review, P&L and cash-flow reporting, month-end close prep, and accountant handoff — with all book-changing actions confirm-gated.
license: MIT
metadata:
  "ai.quickdeploy.skills/read-only": "false"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
  "ai.quickdeploy.skills/destructive-ops": "categorize-transaction,create-adjustment"
---

# QuickBooks Bookkeeping

Run a small business's weekly bookkeeping rhythm in QuickBooks Online:
review bank feeds, keep the books categorized, produce the monthly reports,
prepare the close, and package everything for the accountant.

There is no official Intuit CLI — work goes through the QuickBooks Online
UI procedures and the OAuth2 REST API (see
[references/oauth-setup.md](references/oauth-setup.md)), against a
**sandbox company** by default.

## Safety

- **Sandbox company first.** Intuit developer accounts include sandbox
  companies; use one unless the user explicitly opts into the production
  company (`QBO_PRODUCTION=1`) — and say so before each production write.
- **Book-changing actions are destructive.** Categorizing/matching bank
  rows and creating adjusting entries change the books:
  summarize the exact rows and accounts affected and get explicit
  confirmation first. Batch approvals cover only the listed rows.
- Reconciliation discrepancies are investigated, never force-adjusted.
- Secrets by environment variable name only (`QBO_CLIENT_ID`,
  `QBO_CLIENT_SECRET`, `QBO_REFRESH_TOKEN`, `QBO_REALM_ID`).

## Workflows

Procedures are generated from the pinned docs bundle — follow them exactly:

- Bank feed review: [references/docs-categorize-bank-transactions.md](references/docs-categorize-bank-transactions.md)
- Reporting: [references/docs-run-profit-and-loss-and-cash-flow-reports.md](references/docs-run-profit-and-loss-and-cash-flow-reports.md)
- Close: [references/docs-month-end-close-checklist.md](references/docs-month-end-close-checklist.md)
- Handoff: [references/docs-accountant-handoff.md](references/docs-accountant-handoff.md)

### Weekly rhythm

1. Empty the *For Review* bank feed (confirm-gated categorize/match).
2. Review A/R aging; hand overdue invoices to the collections skill
   (`smb-collections-followup`) rather than chasing from here.
3. Note anything parked in *Ask My Accountant*.

### Month-end

1. Work the close checklist top to bottom.
2. Cross-check processor payouts against the books using the export column
   maps: [references/export-invoice-export.md](references/export-invoice-export.md)
   and [references/export-transactions-export.md](references/export-transactions-export.md).
3. Produce the accountant packet per the handoff procedure.
