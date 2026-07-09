# agent-skills-registry

Official repo for Quick Deploy AI - Agent Skills.

This is a trusted public source for QuickDeploy agent-skill metadata — the
agent-skills analog of [MCP-Registry](https://github.com/QuickDeployAI/MCP-Registry).
The platform reads `skills.json` to populate official default skill entries,
and MCP-Registry's `agent-skills-2-mcp` importer can consume the same file as
a registry index (its `agents` array is the exact index shape that importer
already reads).

## Workspace Layout

This repository is bootstrapped as a pnpm + Turborepo workspace for registry
tools, shared skill libraries, and skill importer packages.

Workspace package lanes:

- `packages/core/*` — shared libraries and workspace config used by importers
  and registry tools (`skill-core`: frontmatter parsing, digest-pinned source
  fetching, content hashing, manifest/content cross-validation).
- `packages/importers/*` — converters that turn external source shapes (CLI
  help trees, OpenAPI specs, product docs, GraphQL schemas) into skill
  packages. Engine names end in `-2-agent-skills`.
- `packages/schemas/*` — skill registry and manifest schemas shared by the
  repo (Zod, consumed from source — no build step).
- `packages/tools/*` — repo-local CLIs and validation tools (`skills-cli`).

Common workspace commands:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm check
```

Skills are static content (SKILL.md + references), not running servers, so
unlike MCP-Registry there is no `packages/runtime` lane, no OCI baking, and
no deployment/liveness machinery — the consuming agent is the runtime.

## Registry Layout

Authored registry entries live under `registry/<provider>/`:

- `*.skill.json` — QuickDeploy `SkillManifest` sources: first-party skills
  whose content is committed under `skills/<provider>/<name>/`, either
  hand-authored (`spec.source.type: file`) or importer-generated from a
  digest-pinned external source.
- `*.skillset.json` — pinned references to skills hosted in external
  repositories, aligned with the monorepo `skills-lock.json` pin format
  (`source`, `sourceType`, `skillPath`, `computedHash`).

Skill content lives at `skills/<provider>/<skill-name>/`:

```
skills/<provider>/<skill-name>/
├── SKILL.md          # required; YAML frontmatter (name, description, …) + body
├── references/       # optional supporting docs
├── scripts/          # optional; every file must be declared in the manifest
└── assets/           # optional
```

`registry/index.json` is generated locally by `skills-cli build` as a source
index and is intentionally ignored by Git. `skills.json` is the generated
machine-readable skill catalog
(`https://raw.githubusercontent.com/QuickDeployAI/agent-skills-registry/main/skills.json`).

## Safety Conventions

Safety is schema-enforced, not prose:

- Every manifest carries a required `spec.safety` block: `readOnly` (default
  posture), enumerated `destructiveOperations` (each requiring explicit
  summarize-then-confirm), and a `sandbox` block whose `defaultMode` is
  `sandbox` unless there is a documented reason otherwise.
- The same facts are mirrored into SKILL.md frontmatter `metadata` as strings
  (`ai.quickdeploy.skills/read-only`, `ai.quickdeploy.skills/sandbox-default`,
  `ai.quickdeploy.skills/destructive-ops`) so consumers that only see the
  content still get them; `skills-cli validate` fails on drift between the
  two.
- Secrets are referenced by environment-variable **name** only
  (`spec.requirements.env[].name`); values never appear in manifests or
  content.
- Scripts surface as executable tools downstream, so any file under
  `scripts/` must be declared in the manifest with
  `allowlistedByDefault: false`; undeclared scripts fail validation.

## Adding a skill

1. Scaffold the content directory and manifest:
   `pnpm --filter @quickdeployai/skills-cli start scaffold skill <provider>/<name> --description "..."`.
2. Flesh out `skills/<provider>/<name>/SKILL.md` and its references; update
   the manifest's safety block if the skill performs writes.
3. Run `pnpm registry:build` to regenerate `skills.json`.
4. Run `pnpm check` before merging (build, typecheck, lint, test, registry
   validation, and a `skills.json` drift check).

See [docs/recipes/authoring-a-skill.md](docs/recipes/authoring-a-skill.md)
for the full authoring guide and
[docs/backlog/smb-agent-skills-expansion.md](docs/backlog/smb-agent-skills-expansion.md)
for the SMB skill-pack roadmap.
