# SMB Agent Skills Expansion

Roadmap for a first SMB (small/medium business) skill pack covering
high-frequency back-office work — payments, bookkeeping, invoicing/
collections, CRM follow-up, commerce operations, and month-end reporting —
plus the source-to-skill importer family that generates and maintains those
skills.

Status: **Phases 0, A, B, and C are implemented.** All four importer
engines exist under `packages/importers/`, all nine skills are committed
under `skills/quickdeploy/`, the first external `*.skillset.json` pin is in
`registry/microsoft/`, and MCP-Registry gained an `smb-agent-skills.mcp.json`
manifest serving these skills (its PR #97). Remaining follow-ups are listed
at the bottom.

## Why these apps

SMBs already spend weekly time in QuickBooks (accounting anchor: invoicing,
payments, payroll, reporting, bank sync, inventory), Stripe (payments),
Square (POS/commerce), Shopify (ecommerce), and HubSpot (CRM). Stripe leads
the roadmap because it is the one integration this organization already
operates in production (billing + Connect marketplace with Pact contract
coverage in the monorepo) — every other target starts from zero.

## Corrections to the original proposal

The original plan assumed infrastructure that did not exist. Recorded here so
the history is honest:

1. **Nothing pre-existed.** `cli-2-agent-skills`, `openapi-2-agent-skills`,
   and a `registry-author` skill existed nowhere; this repo was empty before
   Phase 0. Every importer below is net-new work.
2. **Importer family trimmed from eight to four.**
   - `postman-2-agent-skills` — cut; Postman collections convert to OpenAPI,
     which the OpenAPI importer handles.
   - `oauth-app-2-agent-skills` — cut as an engine; OAuth app setup is a
     shared authoring recipe + per-skill `references/oauth-setup.md`
     (see docs/recipes/authoring-a-skill.md §4), enriching skills rather than
     publishing standalone.
   - `csv-export-2-agent-skills` — folded into `docs-2-agent-skills` as a
     tabular source kind (a CSV column map is another reference artifact,
     not another engine).
   - `runbook-2-agent-skills` — cut; a runbook **is** a skill. `skills-cli
     scaffold skill` plus the authoring recipe replaces it (and replaces the
     assumed "registry-author" skill, which can be authored as an ordinary
     skill later if wanted).
   - `graphql-2-agent-skills` — kept but deferred to the Shopify phase, its
     only consumer (Shopify's Admin REST API is deprecated; GraphQL is the
     supported surface).
3. **Skills are static content, not servers** — no runtime lane, no OCI
   baking, no deployment block (see docs/architecture.md).
4. **Safety became schema, not prose**: required `spec.safety`, frontmatter
   mirrors, and validation drift checks (see README Safety Conventions).
5. **`quickbooks-cli-operator` stays out** until a stable, approved CLI
   contract exists. There is no official Intuit CLI; QuickBooks work goes
   through the OAuth2 REST API against a sandbox company, which is why it
   lands in Phase B via the OpenAPI/docs importers rather than the CLI
   importer.

## Safety defaults (every skill in the pack)

- Read-only default; each write is an enumerated destructive operation with
  summarize-then-confirm.
- Sandbox/test environment default (Stripe test keys, QBO sandbox company,
  Square sandbox, Shopify development store); production is an explicit,
  named env-var opt-in.
- Secrets by environment-variable name only.

## Phase A — hand-authored Stripe skills (no importer needed) — SHIPPED

| Skill | Scope | Safety |
| --- | --- | --- |
| `stripe-payments-operator` *(seeded in Phase 0; CLI reference now importer-generated)* | payments/customers/subscriptions inspection, webhook testing, reconciliation handoff | read-write; `refund-payment`, `cancel-subscription` confirm-gated; `STRIPE_API_KEY` by name; `STRIPE_LIVE_MODE` gate |
| `smb-cashflow-daily-pulse` *(shipped through v2 — all composed sections live)* | daily balance, payouts, failed-charge digest, receivables/payables, sales, low inventory, cash risk | strictly read-only |

Rationale: highest value-per-effort, exercises the full registry pipeline on
the one provider with in-house expertise, and cashflow-pulse is the cheapest
high-visibility cross-app skill to start (it grows per-app sections in later
phases).

## Phase B — first importers + accounting/CRM skills — SHIPPED

Importers (in `packages/importers/`, fixture-tested):

1. **`cli-2-agent-skills`** — CLI help trees → command-reference bundles +
   safety-annotated command tables (destructive/sandbox flags in
   `spec.select.commands`). First consumer: regenerate
   `stripe-payments-operator`'s references from the Stripe CLI.
2. **`openapi-2-agent-skills`** — OpenAPI specs → endpoint reference markdown
   with read-only request selection (`spec.select.requests`), reusing
   MCP-Registry's digest-pinned spec sources (e.g. the HubSpot public spec
   collection pinned in `MCP-Registry/registry/hubspot/api.mcp.json`).

Skills:

| Skill | Source | Notes |
| --- | --- | --- |
| `smb-collections-followup` | Stripe first, QuickBooks second | invoice aging review, reminder drafting; sending anything is confirm-gated |
| `quickbooks-bookkeeping` | openapi/docs importers | QBO sandbox company; OAuth via shared recipe; bank-feed review, P&L/cash-flow prompts, close prep, accountant handoff |
| `hubspot-crm-followup` | openapi importer | read-only GETs matching MCP-Registry's HubSpot curation; contact/deal hygiene, lifecycle stages, pipeline reporting |

## Phase C — docs/GraphQL importers + commerce and cross-app skills — SHIPPED

Importers:

3. **`docs-2-agent-skills`** — product docs/help-center pages **and CSV
   export column maps** (absorbed csv-export) → procedural references with
   validation rules. Needed where OpenAPI is absent or partial (QuickBooks
   exports, bank exports).
4. **`graphql-2-agent-skills`** — GraphQL schema/introspection → query/
   mutation guidance with scope references and safe-operation checklists.
   Built for the Shopify Admin GraphQL API.

Skills:

| Skill | Notes |
| --- | --- |
| `shopify-store-operator` | GraphQL Admin API; catalog/orders/inventory/discounts; all mutations confirm-gated |
| `square-pos-ops` | orders, payments, refunds (confirm-gated), catalog, inventory, customers, fulfillment |
| `smb-month-end-close` | cross-app: pulls Stripe/QuickBooks (later Square/Shopify) exports, reconciles totals, flags missing receipts, produces an owner/accountant review packet; read-only, requires `stripe-payments-operator` + `quickbooks-bookkeeping` |
| `smb-cashflow-daily-pulse` v2 | grows QuickBooks receivables/payables, Square/Shopify sales, low-inventory signals |
| `skill-registry-author` | ordinary authored skill teaching agents to contribute here |
| first `*.skillset.json` entries | pin proven external skills into the catalog |

Cross-app composition convention: prerequisite skills declared in
frontmatter metadata (`ai.quickdeploy.skills/requires`), sibling references
linked relatively; validation resolves both.

## Integration follow-ups

- **MCP-Registry** — DONE (additively): `registry/quickdeploy/smb-agent-skills.mcp.json`
  serves these nine skills via `agent-skills-2-mcp` with zero importer
  changes (`skills.json`'s `agents` array matches the index shape that
  importer consumes). Scripts remain disabled unless
  `SKILLS_MCP_SCRIPT_ALLOWLIST` opts in. Remaining: pin the git ref from
  `#main` to a tagged release once this registry cuts one.
- **monorepo** (consumer action, no repo change): install registry skills
  via `vp dlx skills add`; `skills-lock.json` `computedHash` semantics
  already match this registry's `contentHash` (SHA-256 of the SKILL.md at
  `skillPath`).
- **Real-source refresh**: the Stripe help dump, Square Connect subset, and
  Shopify SDL subset under `sources/` are curated captures — re-capture
  from the live CLIs/specs on a cadence and re-run `skills-cli import`.

## Test plan (standing)

- Importers: fixture-based unit tests with deterministic generated files;
  manifest draft validation; unsafe output-path rejection; missing-source
  diagnostics.
- Skills: SKILL.md frontmatter validation, manifest/content cross-checks
  (safety mirrors, declared references/scripts), generated `skills.json` and
  `registry/index.json` drift gates.
- SMB safety: destructive actions labeled and enumerated; production writes
  require explicit confirmation; secrets referenced only by env/config
  names. All enforced by `skills-cli validate`, which runs inside
  `pnpm check` — the merge gate.
