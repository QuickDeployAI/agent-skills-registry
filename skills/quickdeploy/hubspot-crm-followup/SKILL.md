---
name: hubspot-crm-followup
description: Review HubSpot contacts, companies, and deals read-only — find stale leads, lifecycle-stage gaps, and pipeline follow-ups, and draft (never send) outreach for the owner.
license: MIT
metadata:
  "ai.quickdeploy.skills/read-only": "true"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
---

# HubSpot CRM Follow-up

Keep a small business's HubSpot CRM honest: surface stale leads, lifecycle
gaps, and deals that need a nudge — without changing a single record. All
writes (record updates, emails, tasks) are drafted for the owner to apply,
never executed by this skill.

## Safety

- **Strictly read-only against the CRM.** This skill's token should carry
  read-only scopes; see [references/oauth-setup.md](references/oauth-setup.md).
- Drafted outreach is returned as text for the owner to review and send from
  their own tools — this skill never sends email or creates tasks.
- Secrets by environment variable name only (`HUBSPOT_ACCESS_TOKEN`).
- Prefer a HubSpot developer test account (sandbox) while iterating;
  operating on the production portal requires the user to say so
  (`HUBSPOT_LIVE_MODE=1`).

## Endpoints

All reads go through the two generated endpoints in
[references/api-endpoints.md](references/api-endpoints.md) with
`objectType` of `contacts`, `companies`, or `deals`, using standard
`limit`/`after` paging and the `properties` query parameter to pull only
needed fields.

## Workflows

### Stale-lead sweep

1. Page `GET /crm/v3/objects/{objectType}` for `contacts` with properties
   `email,lifecyclestage,notes_last_contacted,hs_lead_status`.
2. Flag contacts with lifecycle stage `lead`/`marketingqualifiedlead` whose
   last activity is older than 14 days.
3. Output a table: contact, company, stage, days idle, suggested next touch.

### Lifecycle-stage hygiene

1. Pull contacts and their `lifecyclestage`.
2. Flag gaps: customers without a closed-won deal, opportunities with no
   open deal, contacts with no stage at all.
3. Recommend the correct stage per row — as a suggestion list, not an edit.

### Pipeline follow-up prep

1. Pull `deals` with `dealname,dealstage,amount,closedate,hs_lastmodifieddate`.
2. Flag open deals with a close date in the past or no activity in 7 days.
3. For each, draft a short follow-up note the owner can send, citing the
   deal's amount and last touch.

### Weekly pipeline report

Summarize by stage: count, total amount, and week-over-week movement; list
the top three at-risk deals with reasons. Numbers first, then suggestions.
