import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { SkillManifest } from "@quickdeployai/skill-registry-schemas";

export const EXAMPLE_SKILL_MD = `---
name: example-skill
description: An example skill used by skills-cli tests.
metadata:
  "ai.quickdeploy.skills/read-only": "true"
  "ai.quickdeploy.skills/sandbox-default": "sandbox"
---

# Example skill

Body content.
`;

export function exampleManifest(): SkillManifest {
  return {
    apiVersion: "quickdeploy.ai/v1",
    kind: "SkillManifest",
    metadata: {
      name: "ai.quickdeploy/example-skill",
      version: "0.1.0",
      description: "An example skill.",
      labels: ["example", "smb"],
    },
    spec: {
      source: { type: "file", uri: "skills/quickdeploy/example-skill" },
      skill: {
        name: "example-skill",
        description: "An example skill used by skills-cli tests.",
        metadata: {
          "ai.quickdeploy.skills/read-only": "true",
          "ai.quickdeploy.skills/sandbox-default": "sandbox",
        },
      },
      safety: {
        readOnly: true,
        destructiveOperations: [],
        sandbox: { supported: true, defaultMode: "sandbox" },
        secretsPolicy: "env-names-only",
      },
      references: [{ path: "references/usage.md" }],
      scripts: [],
      output: { path: "skills/quickdeploy/example-skill" },
    },
  };
}

export async function writeExampleRegistry(): Promise<string> {
  const rootDir = await mkdtemp(join(tmpdir(), "skills-cli-test-"));
  await writeJson(
    join(rootDir, "registry/quickdeploy/example-skill.skill.json"),
    exampleManifest(),
  );
  await writeText(join(rootDir, "skills/quickdeploy/example-skill/SKILL.md"), EXAMPLE_SKILL_MD);
  await writeText(
    join(rootDir, "skills/quickdeploy/example-skill/references/usage.md"),
    "# Usage\n",
  );
  return rootDir;
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeText(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}
