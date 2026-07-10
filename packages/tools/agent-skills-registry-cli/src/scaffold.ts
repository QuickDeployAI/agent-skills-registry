import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import {
  AGENT_SKILL_MANIFEST_API_VERSION,
  AGENT_SKILL_MANIFEST_KIND,
  AgentSkillManifestSchema,
  type AgentSkillManifest,
} from "@quickdeployai/agent-skill-registry-schemas";
import { slugify, stableJson } from "@quickdeployai/agent-skill-core";

export class ScaffoldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScaffoldError";
  }
}

export interface ScaffoldSkillManifestOptions {
  name: string;
  description: string;
  title?: string;
  version?: string;
  labels?: string[];
  publisher?: string;
  sourceUri?: string;
  outPath?: string;
  format?: "json" | "yaml";
}

export interface ScaffoldSkillManifestResult {
  manifest: AgentSkillManifest;
  path: string;
  text: string;
}

const QUICKDEPLOY_NAME_PREFIX = "ai.quickdeploy/";

function normalizeName(name: string): string {
  return name.includes("/") ? name : `${QUICKDEPLOY_NAME_PREFIX}${slugify(name)}`;
}

function publisherFromName(name: string, explicitPublisher?: string): string {
  if (explicitPublisher) return slugify(explicitPublisher);
  return name.startsWith(QUICKDEPLOY_NAME_PREFIX) ? "quickdeploy" : slugify(name.split("/")[0] ?? "community");
}

function slugFromName(name: string): string {
  return slugify(name.slice(name.indexOf("/") + 1));
}

export function buildScaffoldSkillManifest(options: ScaffoldSkillManifestOptions): AgentSkillManifest {
  if (!options.name) throw new ScaffoldError("scaffold skill-manifest requires a name.");
  if (!options.description) throw new ScaffoldError("scaffold skill-manifest requires a description.");

  const normalizedName = normalizeName(options.name);
  const publisher = publisherFromName(normalizedName, options.publisher);
  const slug = slugFromName(normalizedName);

  return AgentSkillManifestSchema.parse({
    apiVersion: AGENT_SKILL_MANIFEST_API_VERSION,
    kind: AGENT_SKILL_MANIFEST_KIND,
    metadata: {
      name: normalizedName,
      version: options.version ?? "0.1.0",
      ...(options.title ? { title: options.title } : {}),
      description: options.description,
      labels: options.labels ?? [],
    },
    spec: {
      source: {
        type: "file",
        uri: options.sourceUri ?? `skills/${publisher}/${slug}`,
      },
      package: {
        entrypoint: "SKILL.md",
        artifacts: {
          scripts: [],
          references: [],
          assets: [],
        },
      },
      compatibility: {
        agents: [],
        models: [],
        tools: [],
      },
      safety: {
        status: "review",
        permissions: [],
        secrets: [],
      },
      curation: {
        verifiedStatus: "unverified",
        tags: [],
      },
    },
  });
}

export function renderSkillManifest(manifest: AgentSkillManifest, format: "json" | "yaml"): string {
  if (format === "json") return stableJson(manifest);
  return stringifyYaml(manifest, { lineWidth: 0 });
}

export async function writeScaffoldSkillManifest(
  rootDir: string,
  options: ScaffoldSkillManifestOptions,
  force = false,
): Promise<ScaffoldSkillManifestResult> {
  const manifest = buildScaffoldSkillManifest(options);
  const publisher = publisherFromName(manifest.metadata.name, options.publisher);
  const slug = slugFromName(manifest.metadata.name);
  const outPath = resolve(
    rootDir,
    options.outPath ?? join("registry", publisher, `${slug}.skill.json`),
  );
  const format = options.format ?? (outPath.endsWith(".json") ? "json" : "yaml");
  const text = renderSkillManifest(manifest, format);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, text, { encoding: "utf8", flag: force ? "w" : "wx" });
  return { manifest, path: outPath, text };
}

export interface ScaffoldImporterOptions {
  name: string;
  description?: string;
}

export interface ScaffoldImporterFile {
  path: string;
  content: string;
}

const IMPORTER_NAME_PATTERN = /^[a-z][a-z0-9-]*-2-agent-skills$/;

function toPascalCase(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function buildImporterScaffoldFiles(options: ScaffoldImporterOptions): ScaffoldImporterFile[] {
  if (!IMPORTER_NAME_PATTERN.test(options.name)) {
    throw new ScaffoldError('Importer name must match "<source>-2-agent-skills".');
  }

  const pascalName = toPascalCase(options.name);
  const description =
    options.description ?? `${options.name} importer utilities for QuickDeploy agent skills.`;
  const base = `packages/importers/${options.name}`;

  const packageJson = {
    name: `@quickdeployai/${options.name}`,
    version: "0.1.0",
    private: true,
    description,
    type: "module",
    sideEffects: false,
    exports: {
      ".": {
        types: "./src/index.ts",
        import: "./src/index.ts",
        default: "./src/index.ts",
      },
    },
    scripts: {
      build: "tsc --noEmit",
      typecheck: "tsc --noEmit",
      lint: "tsc --noEmit",
      test: "vitest run",
    },
    dependencies: {
      "@quickdeployai/agent-skill-core": "workspace:*",
      "@quickdeployai/agent-skill-importer-core": "workspace:*",
    },
    devDependencies: {
      "@types/node": "catalog:",
      typescript: "catalog:",
      vitest: "catalog:",
    },
  };

  const indexTs = `import { renderSkillMarkdown, slugify, stableJson } from "@quickdeployai/agent-skill-core";
import { normalizeGeneratedFiles, type AgentSkillImporterResult } from "@quickdeployai/agent-skill-importer-core";

export interface ${pascalName}Options {
  name: string;
  description: string;
  body?: string;
  publisher?: string;
  namespace?: string;
  version?: string;
}

export interface ${pascalName}ManifestDraft {
  apiVersion: "quickdeploy.ai/v1";
  kind: "AgentSkillManifest";
  metadata: {
    name: string;
    version: string;
    description: string;
    labels: string[];
  };
  spec: {
    source: { type: "file"; uri: string };
    package: {
      entrypoint: "SKILL.md";
      artifacts: { references: string[]; scripts: string[]; assets: string[] };
    };
  };
}

export function generate${pascalName}(options: ${pascalName}Options): AgentSkillImporterResult<${pascalName}ManifestDraft> {
  const publisher = slugify(options.publisher ?? "quickdeploy");
  const slug = slugify(options.name);
  const namespace = options.namespace ?? (publisher === "quickdeploy" ? "ai.quickdeploy" : publisher);
  const skillRoot = \`skills/\${publisher}/\${slug}\`;
  const body = options.body ?? \`# \${options.name}\\n\\nUse this generated skill after reviewing and replacing these placeholder instructions.\`;
  const manifestDraft: ${pascalName}ManifestDraft = {
    apiVersion: "quickdeploy.ai/v1",
    kind: "AgentSkillManifest",
    metadata: {
      name: \`\${namespace}/\${slug}\`,
      version: options.version ?? "0.1.0",
      description: options.description,
      labels: ["agent-skills"],
    },
    spec: {
      source: { type: "file", uri: skillRoot },
      package: {
        entrypoint: "SKILL.md",
        artifacts: { references: [], scripts: [], assets: [] },
      },
    },
  };

  return {
    diagnostics: [{ severity: "warning", message: "Generated scaffold requires human review." }],
    manifestDraft,
    files: normalizeGeneratedFiles([
      {
        path: \`registry/\${publisher}/\${slug}.skill.json\`,
        content: stableJson(manifestDraft),
      },
      {
        path: \`\${skillRoot}/SKILL.md\`,
        content: renderSkillMarkdown({ name: slug, description: options.description }, body),
      },
    ]),
  };
}
`;

  const testTs = `import { describe, expect, it } from "vitest";
import { generate${pascalName} } from "./index";

describe("${options.name}", () => {
  it("generates a reviewed skill package skeleton", () => {
    const result = generate${pascalName}({
      name: "Demo CLI",
      description: "Use the demo CLI.",
    });

    expect(result.files.map((file) => file.path)).toContain("skills/quickdeploy/demo-cli/SKILL.md");
    expect(result.files.map((file) => file.path)).toContain("registry/quickdeploy/demo-cli.skill.json");
    expect(result.manifestDraft?.metadata.name).toBe("ai.quickdeploy/demo-cli");
    expect(result.diagnostics[0]?.severity).toBe("warning");
  });
});
`;

  return [
    { path: `${base}/package.json`, content: `${JSON.stringify(packageJson, null, 2)}\n` },
    {
      path: `${base}/tsconfig.json`,
      content: '{\n  "extends": "../../../tsconfig.base.json",\n  "include": ["src"]\n}\n',
    },
    { path: `${base}/src/index.ts`, content: indexTs },
    { path: `${base}/src/index.test.ts`, content: testTs },
    { path: `${base}/README.md`, content: `# @quickdeployai/${options.name}\n\n${description}\n` },
  ];
}

export async function writeImporterScaffold(
  rootDir: string,
  options: ScaffoldImporterOptions,
  force = false,
): Promise<string[]> {
  const files = buildImporterScaffoldFiles(options);
  const written: string[] = [];
  for (const file of files) {
    const target = resolve(rootDir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, { encoding: "utf8", flag: force ? "w" : "wx" });
    written.push(target);
  }
  return written;
}
