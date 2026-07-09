# HubSpot app and token setup

Least-privilege setup for this read-only skill.

## Private app (recommended for a single portal)

1. In HubSpot: Settings → Integrations → Private Apps → Create.
2. Grant **read-only** CRM scopes only:
   - `crm.objects.contacts.read`
   - `crm.objects.companies.read`
   - `crm.objects.deals.read`
3. Do **not** grant any `.write` scope — this skill never writes, and a
   read-only token turns a prompt-injection or bug into a no-op.
4. Copy the access token into the environment as `HUBSPOT_ACCESS_TOKEN`.
   Never paste the token into chats, files, or reports.

## OAuth app (multi-portal integrations)

If this skill runs inside a multi-customer integration, use an OAuth app
with the same three read scopes, redirect URI on your own domain, and store
refresh tokens server-side. The skill still only ever sees the short-lived
access token via the `HUBSPOT_ACCESS_TOKEN` environment variable.

## Requests

- Base URL `https://api.hubapi.com`; auth header
  `Authorization: Bearer $HUBSPOT_ACCESS_TOKEN` (by name — the runtime
  substitutes the value).
- Respect `429` rate-limit responses: back off and resume; never hammer.
- Token rotation: if a request returns `401`, report it and stop — do not
  retry with guessed credentials.
