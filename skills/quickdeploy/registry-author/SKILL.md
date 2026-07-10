---
name: registry-author
description: Author and review QuickDeploy agent-skill registry entries.
license: MIT
compatibility: codex>=1
metadata:
  owner: platform
allowed-tools: Read, Bash, ApplyPatch
---

# Registry Author

Use this skill when adding or reviewing a QuickDeploy agent-skill package.

## Workflow

1. Inspect the skill package and confirm `SKILL.md` has `name` and
   `description` frontmatter.
2. Keep reviewed packages under `skills/<publisher>/<skill>/`.
3. Write an `AgentSkillManifest` under `registry/<publisher>/`.
4. Run the registry build and validation commands before publishing.

## Quality Bar

- The skill description must explain when an agent should load the skill.
- Supporting `references/`, `assets/`, and `scripts/` must be deterministic and
  safe to distribute.
- Raw secrets must never appear in registry manifests or skill files.
