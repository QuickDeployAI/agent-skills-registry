import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { serializeSkillMarkdown } from "@quickdeployai/skill-core";
import {
  QUICKDEPLOY_SKILL_NAME_PREFIX,
  SKILL_SAFETY_READ_ONLY_META_KEY,
  SKILL_SAFETY_SANDBOX_DEFAULT_META_KEY,
  SKILL_SLUG_PATTERN,
  SkillManifestSchema,
} from "@quickdeployai/skill-registry-schemas";
import { stableJson } from "./registry-build.js";

export interface ScaffoldSkillOptions {
  rootDir: string;
  provider: string;
  skillName: string;
  description: string;
  title?: string;
  force?: boolean;
}

export interface ScaffoldSkillResult {
  skillDir: string;
  manifestPath: string;
  files: string[];
}

/**
 * Scaffold a hand-authored skill: the committed content directory
 * (`skills/<provider>/<name>/` with SKILL.md + references/) and its
 * registry manifest (`registry/<provider>/<name>.skill.json`), read-only
 * and sandbox-first by default so authors opt in to writes explicitly.
 */
export async function scaffoldSkill(options: ScaffoldSkillOptions): Promise<ScaffoldSkillResult> {
  if (!SKILL_SLUG_PATTERN.test(options.provider)) {
    throw new Error(`Provider "${options.provider}" must be a lowercase kebab-case slug.`);
  }
  if (!SKILL_SLUG_PATTERN.test(options.skillName)) {
    throw new Error(`Skill name "${options.skillName}" must be a lowercase kebab-case slug.`);
  }
  if (!options.description.trim()) {
    throw new Error("A non-empty --description is required.");
  }

  const skillPath = `skills/${options.provider}/${options.skillName}`;
  const skillDir = join(options.rootDir, skillPath);
  const manifestPath = `registry/${options.provider}/${options.skillName}.skill.json`;

  const manifest = SkillManifestSchema.parse({
    apiVersion: "quickdeploy.ai/v1",
    kind: "SkillManifest",
    metadata: {
      name: `${QUICKDEPLOY_SKILL_NAME_PREFIX}${options.skillName}`,
      version: "0.1.0",
      ...(options.title === undefined ? {} : { title: options.title }),
      description: options.description.slice(0, 100),
      labels: [],
    },
    spec: {
      source: { type: "file", uri: skillPath },
      skill: {
        name: options.skillName,
        description: options.description,
        metadata: {
          [SKILL_SAFETY_READ_ONLY_META_KEY]: "true",
          [SKILL_SAFETY_SANDBOX_DEFAULT_META_KEY]: "sandbox",
        },
      },
      safety: {
        readOnly: true,
        destructiveOperations: [],
        sandbox: { supported: true, defaultMode: "sandbox" },
        secretsPolicy: "env-names-only",
      },
      references: [{ path: "references/usage.md", title: "Usage" }],
      scripts: [],
      output: { path: skillPath },
    },
  });

  const skillMd = serializeSkillMarkdown({
    frontmatter: manifest.spec.skill,
    body: [
      `# ${options.title ?? options.skillName}`,
      "",
      options.description,
      "",
      "## Safety",
      "",
      "- This skill is read-only by default. Do not perform writes.",
      "- Reference secrets by environment variable name only; never inline values.",
      "- Prefer sandbox/test environments; switching to production requires an explicit, user-confirmed opt-in.",
      "",
      "## Workflow",
      "",
      "1. TODO: describe the operating steps.",
      "",
      "See [references/usage.md](references/usage.md).",
    ].join("\n"),
  });

  const files = [
    { path: join(skillDir, "SKILL.md"), contents: skillMd },
    {
      path: join(skillDir, "references", "usage.md"),
      contents: `# Usage\n\nTODO: document how an agent should use ${options.skillName}.\n`,
    },
    { path: join(options.rootDir, manifestPath), contents: stableJson(manifest) },
  ];

  if (!options.force) {
    for (const file of files) {
      const exists = await fileExists(file.path);
      if (exists) {
        throw new Error(`Refusing to overwrite ${file.path} (pass --force to override).`);
      }
    }
  }

  for (const file of files) {
    await mkdir(join(file.path, ".."), { recursive: true });
    await writeFile(file.path, file.contents, "utf8");
  }

  return { skillDir, manifestPath, files: files.map((file) => file.path) };
}

async function fileExists(path: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  return access(path).then(
    () => true,
    () => false,
  );
}
