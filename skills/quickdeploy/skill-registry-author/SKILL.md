---
name: skill-registry-author
description: Author, validate, and publish agent skills in the QuickDeploy agent-skills-registry — scaffold the content and manifest, declare safety honestly, run importers, and get pnpm check green before opening a PR.
license: MIT
metadata:
  "ai.quickdeploy.skills/read-only": "false"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
  "ai.quickdeploy.skills/destructive-ops": "publish-registry-change"
---

# Skill Registry Author

Contribute a skill to the QuickDeploy agent-skills-registry, end to end.
The repository's own docs are the source of truth — this skill is the
operating procedure that ties them together.

## Safety

- Work on a branch; the only destructive operation is publishing the
  change (commit/push/PR), and it requires the user to confirm the diff
  summary first.
- Never weaken a skill's safety block to make validation pass — fix the
  content instead.
- Secrets never appear in manifests, SKILL.md files, or fixtures: env-var
  names only.

## Procedure

1. **Scaffold**:
   `pnpm --filter @quickdeployai/skills-cli start scaffold skill <provider>/<name> --description "..."`.
2. **Author** the SKILL.md body and references following
   `docs/recipes/authoring-a-skill.md` — Safety section first, workflows as
   numbered steps, lookup material in `references/`.
3. **Declare safety honestly** in the manifest (`spec.safety`) and mirror
   it in frontmatter metadata (read-only, sandbox default, destructive-ops
   CSV). Validation fails on drift — that is the point.
4. **Generated skills**: put the pinned source under `sources/<provider>/`
   (or use a digest-pinned URL), fill `spec.importer` + `spec.select`, then
   run `pnpm --filter @quickdeployai/skills-cli start import --manifest
   registry/<provider>/<name>.skill.json`.
5. **Regenerate the catalog**: `pnpm registry:build`.
6. **Gate**: `pnpm check` — build, typecheck, lint, tests, registry
   validation (namespace, semver, duplicates, safety mirrors, relative
   links, requires resolution), and the skills.json drift check.
7. **Publish** (confirm-gated): commit with a descriptive message, push the
   branch, open the PR, and include what the skill does, its safety
   posture, and how it was verified.

## Review checklist

Before requesting review, confirm:

- [ ] `spec.safety.readOnly` is honest; every write is enumerated with
      `confirmation: "explicit"`.
- [ ] Sandbox default with a named production switch env var.
- [ ] Every reference file exists and is declared; no undeclared scripts.
- [ ] Cross-app links (`../<skill>/references/...`) resolve, and
      `ai.quickdeploy.skills/requires` lists every composed skill.
- [ ] `skills.json` regenerated and committed (drift gate passes).
