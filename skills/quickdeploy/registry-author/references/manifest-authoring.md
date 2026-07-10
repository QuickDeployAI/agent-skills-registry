# AgentSkillManifest Authoring

An `AgentSkillManifest` points from registry metadata to a reviewed skill
package. The V1 registry requires local reviewed packages, exact semantic
versions, safe relative artifact paths, and explicit curation/safety metadata.

Run:

```bash
pnpm --filter @quickdeployai/agent-skills-registry-cli registry:build
pnpm --filter @quickdeployai/agent-skills-registry-cli registry:validate
```
