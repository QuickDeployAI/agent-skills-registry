# Sandbox vs production

Stripe separates test and live data by API key prefix. This skill defaults
to **test mode** and treats live mode as an explicit, per-session opt-in.

## Test mode (default)

- Keys: `sk_test_*` (secret), `pk_test_*` (publishable).
- Test-mode data is fully isolated; refunds, cancellations, and webhook
  triggers are safe to exercise freely.
- `stripe trigger` and `stripe listen` only operate on test-mode events.
- Use Stripe's test cards (e.g. `4242 4242 4242 4242`) for payment flows.

## Live mode (explicit opt-in only)

Operate in live mode only when all of the following hold:

1. The user explicitly asked for live data in this session.
2. `STRIPE_LIVE_MODE=1` is set (the environment-level opt-in gate this skill
   declares in its manifest).
3. Each destructive call still goes through the summarize-then-confirm
   protocol — live mode never relaxes confirmation.

When in live mode, prefix reports with a clear "LIVE MODE" marker so the
user always knows which environment results came from.

## Choosing at runtime

- If `STRIPE_LIVE_MODE` is unset or not `1`: use test keys; refuse live-mode
  requests with a pointer to this document.
- Never mix modes within a single workflow (e.g. reconciling live payouts
  against test transactions produces nonsense).
