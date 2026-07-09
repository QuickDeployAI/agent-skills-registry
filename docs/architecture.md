# Architecture: what maps from MCP-Registry, and what was cut

This repository is deliberately shaped like
[MCP-Registry](https://github.com/QuickDeployAI/MCP-Registry), so
contributors can move between the two without relearning conventions.

## Maps 1:1

| MCP-Registry | agent-skills-registry |
| --- | --- |
| pnpm + Turborepo workspace, Node ≥22.18, `catalog:` dep pins | same |
| `packages/{core,importers,schemas,tools}` lanes | same (minus `runtime`) |
| `registry/<provider>/*.mcp.json` (compiled) / `*.server.json` (external) | `registry/<provider>/*.skill.json` (first-party) / `*.skillset.json` (external pins) |
| `schemas/mcp-manifest.v1.schema.json`, `servers-json.schema.json` | `schemas/skill-manifest.v1.schema.json`, `skillset.v1.schema.json`, `skills-json.schema.json` |
| generated `servers.json` envelope, curation only under reverse-DNS `_meta` keys | generated `skills.json`, same `_meta` convention (`ai.quickdeploy.registry/curation`, `.../safety`) |
| `registry-cli build [--check] / validate / scaffold` (tsx, no build step) | `skills-cli` with the same commands |
| `pnpm check` = turbo build/typecheck/lint/test + registry validation | same, plus a `skills.json` drift gate (`build --check`) |
| collect-all validation (never fail-fast), name/namespace/exact-semver/duplicate rules | same rules, ported in `packages/tools/skills-cli/src/registry-validate.ts` |
| importer engines named `<source>-2-mcp` | importer engines named `<source>-2-agent-skills` |
| per-importer config-schema registry (`IMPORTER_CONFIG_SCHEMAS`) | `SKILL_IMPORTER_CONFIG_SCHEMAS` in `packages/schemas/skill-registry-schemas` |

## Deliberately cut

Skills are static content — SKILL.md plus references — not running servers.
The consuming agent is the runtime. That removes:

- **`packages/runtime/`** (no `mcp-host` analog; nothing to host).
- **OCI images, digest-pinned baking, `bake`, `generated/oci-image-digests.json`**
  (nothing ships as a container).
- **`deployment` manifest block, transports, `validate-remotes`/liveness**
  (nothing is deployed or reachable).
- **Changesets** (all packages are private and nothing publishes yet; add it
  back when a package first needs versioned publishing).

## New here (no MCP-Registry equivalent)

- **Committed skill content** at `skills/<provider>/<name>/`. MCP-Registry
  compiles manifests into catalog entries pointing at runtime images; this
  registry *is* the content host.
- **Schema-enforced safety**: required `spec.safety` (read-only default,
  enumerated destructive operations with explicit confirmation, sandbox
  defaults) mirrored into SKILL.md frontmatter metadata strings, with
  validation failing on drift. See the README's Safety Conventions.
- **`*.skillset.json`** external pins aligned with the monorepo
  `skills-lock.json` format (`computedHash` = SHA-256 of the SKILL.md file at
  `skillPath`), so consumer-side pinning and registry entries agree.

## Integration contract

MCP-Registry's `packages/importers/agent-skills-2-mcp` consumes three input
shapes: a local directory tree, a pinned git URL, or a **registry index
JSON** whose `agents` array is `[{ skill: "<path to SKILL.md>", summary }]`.
The generated `skills.json` deliberately supersets that index shape — its
`agents` array is byte-compatible — so MCP-Registry can point
`registry/quickdeploy/agent-skills.mcp.json` at this repository with zero
importer changes. The SKILL.md frontmatter contract (required
`name`/`description`; optional `license`, `compatibility`, `allowed-tools`,
string-map `metadata`) is likewise kept in lockstep with that importer's
`skill-loader.ts` and the monorepo's `inferAgentSkill()`.

Follow-ups tracked in the backlog, not done here:

- Repoint MCP-Registry's agent-skills manifests at a pinned ref of this
  repository once content stabilizes.
- Consumer-side installs from this registry via `vp dlx skills add` in the
  monorepo (hash semantics already aligned).
