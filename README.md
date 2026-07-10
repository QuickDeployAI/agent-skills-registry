# Agent Skills Registry

Official repo for Quick Deploy AI agent skills.

This is the agent-skill companion to
[`mcp-registry`](https://github.com/QuickDeployAI/mcp-registry). It provides a
trusted public source for reviewed `SKILL.md` packages, schema-validated
registry manifests, importer utilities, and generated catalog files that agent
clients can consume directly.

## Workspace Layout

This repository is a pnpm + Turborepo workspace.

- `skills/<publisher>/<skill>/` - reviewed skill packages containing
  `SKILL.md` plus optional `scripts/`, `references/`, and `assets/`.
- `registry/<publisher>/*.skill.json|yaml` - authored
  `AgentSkillManifest` sources.
- `packages/core/*` - shared parsing, validation, and importer primitives.
- `packages/importers/*` - converters that turn external sources into reviewed
  agent-skill packages.
- `packages/schemas/*` - public registry and manifest schemas.
- `packages/tools/*` - repo-local CLIs and validation tools.

Common workspace commands:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm check
```

## Registry Layout

Authored entries live under `registry/<publisher>/` and point at reviewed
packages under `skills/<publisher>/<skill>/`.

Generated catalog outputs:

- `skills.json` - canonical machine-readable agent-skill catalog.
- `registry/index.json` - compatibility index with `agents[].skill` entries for
  runtimes that already understand agent-skill registry indexes.

Regenerate and validate them with:

```bash
pnpm --filter @quickdeployai/agent-skills-registry-cli registry:build
pnpm --filter @quickdeployai/agent-skills-registry-cli registry:validate
```

## Adding A Skill

1. Add a skill package at `skills/<publisher>/<skill>/SKILL.md`.
2. Add any supporting `references/`, `assets/`, or reviewed `scripts/`.
3. Add an authored manifest at `registry/<publisher>/<skill>.skill.json`.
4. Run `pnpm --filter @quickdeployai/agent-skills-registry-cli registry:build`.
5. Run `pnpm check` before merging.

## Importers

V1 includes two starter importers:

- `cli-2-agent-skills` - converts CLI help or manpage text into procedural
  skills with command-reference material.
- `openapi-2-agent-skills` - converts OpenAPI documents into API-use skills
  with operation references.

Importer scratch output belongs under `.generated/agent-skills-codegen/` and is
ignored. Reviewed generated packages should be copied into `skills/` before
publication.
