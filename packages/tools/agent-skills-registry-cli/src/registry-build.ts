import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path, { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import {
  AgentSkillManifestSchema,
  AgentSkillsJsonEnvelopeSchema,
  AGENT_SKILLS_JSON_SCHEMA_ID,
  QUICKDEPLOY_AGENT_SKILL_CURATION_META_KEY,
  QUICKDEPLOY_AGENT_SKILL_MANIFEST_META_KEY,
  skillSlugFromName,
  type AgentSkillManifest,
  type AgentSkillsCatalogEntry,
  type AgentSkillsJsonEnvelope,
} from "@quickdeployai/agent-skill-registry-schemas";
import {
  assertSafeRelativePath,
  loadSkillPackage,
  stableJson,
  toPosixPath,
} from "@quickdeployai/agent-skill-core";

export interface RegistryBuildOptions {
  rootDir: string;
}

export interface RegistryIndexAgent {
  id: string;
  name: string;
  summary: string;
  skill: string;
  canonical_url?: string;
}

export interface RegistryCompatibilityIndex {
  schemaVersion: "quickdeploy.agent-skills-registry/v1";
  generatedBy: "@quickdeployai/agent-skills-registry-cli";
  agents: RegistryIndexAgent[];
}

export interface RegistryBuildArtifacts {
  skillsJson: AgentSkillsJsonEnvelope;
  registryIndex: RegistryCompatibilityIndex;
  files: {
    "skills.json": string;
    "registry/index.json": string;
  };
}

interface RegistrySource {
  provider: string;
  path: string;
  manifest: AgentSkillManifest;
  entry: AgentSkillsCatalogEntry;
}

const MANIFEST_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);

export async function buildRegistryArtifacts(
  options: RegistryBuildOptions,
): Promise<RegistryBuildArtifacts> {
  const sources = await discoverRegistrySources(options.rootDir);
  const skills = sources
    .map((source) => source.entry)
    .sort((left, right) => left.id.localeCompare(right.id));

  const skillsJson = AgentSkillsJsonEnvelopeSchema.parse({
    $schema: AGENT_SKILLS_JSON_SCHEMA_ID,
    skills,
    _meta: {
      "ai.quickdeploy.agent-skills/generatedBy": "@quickdeployai/agent-skills-registry-cli",
      "ai.quickdeploy.agent-skills/sourceCount": skills.length,
    },
  });

  const registryIndex = buildCompatibilityIndex(skills);

  return {
    skillsJson,
    registryIndex,
    files: {
      "skills.json": stableJson(skillsJson),
      "registry/index.json": stableJson(registryIndex),
    },
  };
}

export async function writeRegistryArtifacts(
  options: RegistryBuildOptions,
  artifacts?: RegistryBuildArtifacts,
): Promise<void> {
  const artifactsToWrite = artifacts ?? (await buildRegistryArtifacts(options));
  for (const [filePath, contents] of Object.entries(artifactsToWrite.files)) {
    const target = join(options.rootDir, filePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }
}

export async function checkGeneratedRegistryArtifacts(options: RegistryBuildOptions): Promise<{
  ok: boolean;
  changed: string[];
}> {
  const artifacts = await buildRegistryArtifacts(options);
  const changed: string[] = [];
  for (const [filePath, expected] of Object.entries(artifacts.files)) {
    const actual = await readFile(join(options.rootDir, filePath), "utf8").catch(() => "");
    if (actual !== expected) changed.push(filePath);
  }
  return { ok: changed.length === 0, changed };
}

function buildCompatibilityIndex(skills: readonly AgentSkillsCatalogEntry[]): RegistryCompatibilityIndex {
  return {
    schemaVersion: "quickdeploy.agent-skills-registry/v1",
    generatedBy: "@quickdeployai/agent-skills-registry-cli",
    agents: skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      summary: skill.description,
      skill: toPosixPath(path.relative("registry", skill.skill)),
    })),
  };
}

async function discoverRegistrySources(rootDir: string): Promise<RegistrySource[]> {
  const registryDir = join(rootDir, "registry");
  const files = await findFiles(registryDir, (name, filePath) => {
    const relativePath = toPosixPath(relative(rootDir, filePath));
    if (relativePath === "registry/index.json") return false;
    return name.includes(".skill.") && MANIFEST_EXTENSIONS.has(extname(name));
  });

  const sources = await Promise.all(files.map((filePath) => readRegistrySource(rootDir, filePath)));
  return sources.sort((left, right) => left.path.localeCompare(right.path));
}

async function readRegistrySource(rootDir: string, filePath: string): Promise<RegistrySource> {
  const relativePath = toPosixPath(relative(rootDir, filePath));
  const manifest = parseRegistryManifest(await readStructuredFile(filePath));
  const provider = providerFromRegistryPath(relativePath);
  const entry = await compileManifestToCatalogEntry(rootDir, manifest, relativePath);
  return { provider, path: relativePath, manifest, entry };
}

export async function compileManifestToCatalogEntry(
  rootDir: string,
  manifestInput: unknown,
  sourcePath: string,
): Promise<AgentSkillsCatalogEntry> {
  const manifest = parseRegistryManifest(manifestInput);
  const sourceRoot = resolveManifestSourceRoot(rootDir, manifest);
  const skillPackage = await loadSkillPackage(sourceRoot, manifest.spec.package.entrypoint);
  const skillPath = toPosixPath(relative(rootDir, join(sourceRoot, manifest.spec.package.entrypoint)));

  return {
    id: manifest.metadata.name,
    name: skillPackage.frontmatter.name,
    ...(manifest.metadata.title ? { title: manifest.metadata.title } : {}),
    version: manifest.metadata.version,
    description: manifest.metadata.description,
    labels: manifest.metadata.labels,
    skill: skillPath,
    source: manifest.spec.source,
    package: manifest.spec.package,
    artifacts: {
      scripts: skillPackage.artifacts.scripts.map((item) => `scripts/${item}`),
      references: skillPackage.artifacts.references.map((item) => `references/${item}`),
      assets: skillPackage.artifacts.assets.map((item) => `assets/${item}`),
    },
    compatibility: manifest.spec.compatibility,
    safety: manifest.spec.safety,
    curation: manifest.spec.curation,
    _meta: {
      [QUICKDEPLOY_AGENT_SKILL_CURATION_META_KEY]: manifest.spec.curation,
      [QUICKDEPLOY_AGENT_SKILL_MANIFEST_META_KEY]: manifest,
      "ai.quickdeploy.agent-skills/sourcePath": sourcePath,
      "ai.quickdeploy.agent-skills/slug": skillSlugFromName(manifest.metadata.name),
    },
  };
}

export function parseRegistryManifest(value: unknown): AgentSkillManifest {
  return AgentSkillManifestSchema.parse(value);
}

export function resolveManifestSourceRoot(rootDir: string, manifest: AgentSkillManifest): string {
  if (manifest.spec.source.type !== "file") {
    throw new Error("Registry manifests must point at reviewed local file sources in V1.");
  }

  const uri = manifest.spec.source.uri;
  if (uri.startsWith("file://")) return fileURLToPath(uri);
  return resolve(rootDir, assertSafeRelativePath(uri));
}

async function readStructuredFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  if (filePath.endsWith(".json")) return JSON.parse(raw) as unknown;
  return parseYaml(raw) as unknown;
}

function providerFromRegistryPath(relativePath: string): string {
  const parts = relativePath.split("/");
  if (parts.length < 3 || parts[0] !== "registry") {
    throw new Error(`Registry sources must live under registry/<provider>/: ${relativePath}`);
  }
  return parts[1]!;
}

async function findFiles(
  dir: string,
  predicate: (name: string, path: string) => boolean,
): Promise<string[]> {
  const files: string[] = [];

  async function visit(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && predicate(entry.name, fullPath)) {
        files.push(fullPath);
      }
    }
  }

  await visit(dir);
  return files.sort((left, right) => left.localeCompare(right));
}
