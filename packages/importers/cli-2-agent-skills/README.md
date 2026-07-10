# @quickdeployai/cli-2-agent-skills

Importer utilities that convert reviewed CLI help or manpage text into a
reviewable agent-skill package.

The importer emits deterministic files under `skills/<publisher>/<slug>/` and a
manifest draft that can be committed under `registry/<publisher>/` after human
review.
