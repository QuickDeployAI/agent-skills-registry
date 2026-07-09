# QuickBooks Online app and token setup

Least-privilege OAuth2 setup for the QuickBooks Online Accounting API.

## App creation

1. Create a developer account at https://developer.intuit.com and an app of
   type **QuickBooks Online and Payments**.
2. Request only the `com.intuit.quickbooks.accounting` scope — this skill
   does not need Payments scopes.
3. Add your redirect URI (your own domain, or the Intuit playground URI for
   sandbox experimentation only).

## Sandbox vs production

- Every developer account includes a **sandbox company**; its realm ID is
  shown on the app's keys page. All development and this skill's default
  operation happen there (base URL
  `https://sandbox-quickbooks.api.intuit.com`).
- Production keys are separate and require Intuit's app review for public
  apps. Production base URL: `https://quickbooks.api.intuit.com`. This
  skill only targets production when `QBO_PRODUCTION=1` and the user
  explicitly asked.

## Tokens

- OAuth2 authorization-code flow yields an access token (~1h) and refresh
  token (~100 days, rotates on use). Store both server-side; the skill
  references them only as `QBO_REFRESH_TOKEN` etc. — never values.
- Environment variables: `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`,
  `QBO_REFRESH_TOKEN`, `QBO_REALM_ID`, optional `QBO_PRODUCTION`.
- On `401`, refresh once; if refresh fails, report and stop — never retry
  with guessed credentials.
