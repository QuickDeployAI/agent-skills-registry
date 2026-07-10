# Authoring a skill

How to add a first-party skill to this registry, from scaffold to green CI.

## 1. Scaffold

```bash
pnpm --filter @quickdeployai/skills-cli start scaffold skill <provider>/<name> \
  --description "One-sentence description of what the skill does." \
  --title "Human Title"
```

This creates:

- `skills/<provider>/<name>/SKILL.md` — frontmatter + body skeleton,
  read-only and sandbox-first by default.
- `skills/<provider>/<name>/references/usage.md` — first reference stub.
- `registry/<provider>/<name>.skill.json` — the `SkillManifest`.

Slugs are lowercase kebab-case. First-party manifests are named
`ai.quickdeploy/<name>` — the validator enforces the namespace.

## 2. Write the SKILL.md

- **Frontmatter** carries the identity contract: required `name` and
  `description` (these must match the manifest's `spec.skill` exactly),
  optional `license`, `compatibility`, `allowed-tools`, and a string-valued
  `metadata` map.
- **Body** is the procedure. Lead with a Safety section, then Requirements,
  then step-by-step Workflows. Write for an agent operating on a real
  account: name the exact commands/endpoints, and say what *not* to do.
- Put durable lookup material (command tables, column maps, API field
  glossaries) in `references/*.md` and link them relatively.

## 3. Declare safety honestly

The manifest's `spec.safety` block is required and validated:

- `readOnly: true` — the default posture. If the skill performs any write,
  set `readOnly: false` **and** enumerate every destructive operation:

  ```json
  "destructiveOperations": [
    { "name": "refund-payment", "description": "…", "confirmation": "explicit" }
  ]
  ```

  The skill body must implement summarize-then-confirm for each one: show the
  exact objects/amounts affected and wait for explicit user confirmation
  before executing.
- `sandbox.defaultMode` is `sandbox` unless there is a documented reason.
  Name the env var that gates production (`switchEnvVar`).
- Mirror the same facts into frontmatter `metadata` as strings — validation
  fails on drift:

  ```yaml
  metadata:
    "ai.quickdeploy.skills/read-only": "false"
    "ai.quickdeploy.skills/sandbox-default": "sandbox"
    "ai.quickdeploy.skills/destructive-ops": "refund-payment,cancel-subscription"
  ```

## 4. Secrets and OAuth setup

- List every environment variable the skill needs under
  `spec.requirements.env` — names only, `secret: true` where applicable.
  Values never appear anywhere in this repository.
- For OAuth-based providers (QuickBooks, HubSpot, Shopify), do not write a
  standalone "oauth setup skill". Add a `references/oauth-setup.md` to the
  skill that needs it, covering: app creation, minimal scopes
  (least-privilege), redirect URI, where tokens live (env var names), and
  refresh behavior. Reuse the structure from existing skills' references.

## 5. Scripts (rare)

Files under `scripts/` become executable tools when the skill is served
through MCP (`agent-skills-2-mcp`), so each one must be declared in the
manifest with `allowlistedByDefault: false`. Undeclared scripts fail
validation. Prefer documented CLI invocations in the body over bundled
scripts.

## 6. Regenerate and check

```bash
pnpm registry:build   # regenerates skills.json (committed)
pnpm check            # build + typecheck + lint + test + validate + drift gate
```

`pnpm check` is the merge gate; CI runs exactly this.

## Cross-app skills

Skills that compose other skills (e.g. a month-end close that reads Stripe
and QuickBooks) should:

- declare their prerequisites in frontmatter metadata, e.g.
  `"ai.quickdeploy.skills/requires": "stripe-payments-operator,quickbooks-bookkeeping"`;
- link sibling references by relative path
  (`../stripe-payments-operator/references/…`);
- stay read-only by default and route any writeback through the composed
  skill's own destructive-operation confirmation flow.
