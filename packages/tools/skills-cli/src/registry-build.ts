import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { computeSkillContentHash, loadSkillDir } from "@quickdeployai/skill-core";
import {
  QUICKDEPLOY_REGISTRY_CURATION_META_KEY,
  QUICKDEPLOY_REGISTRY_SAFETY_META_KEY,
  SKILLS_JSON_SCHEMA_URI,
  SkillsJsonEnvelopeSchema,
  type AgentIndexEntry,
  type SkillEntry,
  type SkillsJsonEnvelope,
} from "@quickdeployai/skill-registry-schemas";
import {
  discoverRegistrySources,
  type DiscoveredSkillManifest,
  type DiscoveredSkillSet,
} from "./registry-discovery.js";

export interface RegistryBuildOptions {
  rootDir: string;
}

export interface RegistryBuildArtifacts {
  skillsJson: SkillsJsonEnvelope;
  files: Record<string, string>;
  generatedFiles: Record<string, string>;
}

export async function buildRegistryArtifacts(
  options: RegistryBuildOptions,
): Promise<RegistryBuildArtifacts> {
  const { sources, problems } = await discoverRegistrySources(options.rootDir);
  if (problems.length > 0) {
    const details = problems.map((problem) => `- ${problem.path}: ${problem.message}`).join("\n");
    throw new Error(`Registry sources failed to parse:\n${details}`);
  }

  const agents: AgentIndexEntry[] = [];
  const skills: SkillEntry[] = [];

  for (const source of sources) {
    if (source.kind === "skill-manifest") {
      const compiled = await compileSkillManifestEntry(options.rootDir, source);
      skills.push(compiled.entry);
      if (compiled.agent) agents.push(compiled.agent);
    } else {
      skills.push(...compileSkillSetEntries(source));
    }
  }

  agents.sort((left, right) => left.skill.localeCompare(right.skill));
  skills.sort((left, right) => left.name.localeCompare(right.name));

  const parsed = SkillsJsonEnvelopeSchema.parse({
    $schema: SKILLS_JSON_SCHEMA_URI,
    agents,
    skills,
    _meta: {
      "ai.quickdeploy.registry/generatedBy": "@quickdeployai/skills-cli",
      "ai.quickdeploy.registry/sourceCount": skills.length,
    },
  });

  return {
    skillsJson: parsed,
    files: {
      "skills.json": stableJson(parsed),
    },
    generatedFiles: {
      "registry/index.json": stableJson({
        sources: sources.map((source) => ({
          path: source.path,
          kind: source.kind,
          name: source.kind === "skill-manifest"
            ? source.manifest.metadata.name
            : source.skillset.metadata.name,
        })),
      }),
    },
  };
}

async function compileSkillManifestEntry(
  rootDir: string,
  source: DiscoveredSkillManifest,
): Promise<{ entry: SkillEntry; agent?: AgentIndexEntry }> {
  const manifest = source.manifest;
  const skillPath = manifest.spec.output.path;
  const category = manifest.spec.importer?.engine ?? "authored";
  const tags = [
    manifest.spec.importer ? "manifest-backed" : "authored",
    ...manifest.metadata.labels,
  ];

  const entry: SkillEntry = {
    name: manifest.metadata.name,
    version: manifest.metadata.version,
    skillPath,
    _meta: {
      [QUICKDEPLOY_REGISTRY_CURATION_META_KEY]: {
        verifiedStatus: "review",
        category,
        isOfficial: true,
        tags,
      },
      [QUICKDEPLOY_REGISTRY_SAFETY_META_KEY]: {
        readOnly: manifest.spec.safety.readOnly,
        destructiveCount: manifest.spec.safety.destructiveOperations.length,
        sandboxDefault: manifest.spec.safety.sandbox.defaultMode,
      },
    },
  };
  if (manifest.metadata.description !== undefined) {
    entry.description = manifest.metadata.description;
  }
  if (manifest.metadata.labels.length > 0) {
    entry.labels = manifest.metadata.labels;
  }

  const skillDir = join(rootDir, skillPath);
  const skill = await loadSkillDir(skillDir).catch(() => null);
  if (!skill) {
    // Importer-generated skills may not be materialized yet; the entry still
    // compiles, but only materialized skills join the agents compat index.
    return { entry };
  }

  entry.contentHash = await computeSkillContentHash(skillDir);
  return {
    entry,
    agent: {
      skill: `${skillPath}/SKILL.md`,
      summary: skill.frontmatter.description,
    },
  };
}

function compileSkillSetEntries(source: DiscoveredSkillSet): SkillEntry[] {
  const skillset = source.skillset;
  const namespace = skillset.metadata.name.split("/")[0] ?? skillset.metadata.name;

  return skillset.spec.skills.map((pin) => {
    const entry: SkillEntry = {
      name: `${namespace}/${pin.name}`,
      skillPath: dirname(pin.skillPath),
      contentHash: pin.computedHash,
      _meta: {
        [QUICKDEPLOY_REGISTRY_CURATION_META_KEY]: {
          verifiedStatus: "review",
          category: "skillset",
          isOfficial: false,
          tags: ["skillset-pinned", ...skillset.metadata.labels],
        },
        "ai.quickdeploy.registry/source": {
          source: pin.source,
          sourceType: pin.sourceType,
          ...(pin.ref === undefined ? {} : { ref: pin.ref }),
          skillPath: pin.skillPath,
        },
      },
    };
    if (pin.summary !== undefined) {
      entry.description = pin.summary;
    }
    return entry;
  });
}

export async function writeRegistryArtifacts(
  options: RegistryBuildOptions,
  artifacts?: RegistryBuildArtifacts,
): Promise<void> {
  const artifactsToWrite = artifacts ?? (await buildRegistryArtifacts(options));
  for (const [path, contents] of Object.entries({
    ...artifactsToWrite.files,
    ...artifactsToWrite.generatedFiles,
  })) {
    const target = join(options.rootDir, path);
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

  for (const [path, expected] of Object.entries(artifacts.files)) {
    const actual = await readFile(join(options.rootDir, path), "utf8").catch(() => "");
    if (actual !== expected) changed.push(path);
  }

  return { ok: changed.length === 0, changed };
}

export function stableJson(value: unknown): string {
  return compactShortStringArrays(`${JSON.stringify(value, null, 2)}\n`);
}

function compactShortStringArrays(json: string): string {
  const lines = json.split("\n");
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const start = /^(\s*(?:"[^"]+": )?)\[$/.exec(line);
    if (!start) {
      output.push(line);
      continue;
    }

    const prefix = start[1] ?? "";
    const itemIndent = `${line.match(/^\s*/)?.[0] ?? ""}  `;
    const items: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const item = new RegExp(`^${escapeRegExp(itemIndent)}(".*")(?:,)?$`).exec(
        lines[cursor] ?? "",
      );
      if (!item) break;
      items.push(item[1] ?? "");
      cursor += 1;
    }

    const end = new RegExp(`^${escapeRegExp(line.match(/^\s*/)?.[0] ?? "")}\\](,?)$`).exec(
      lines[cursor] ?? "",
    );
    const inline = `${prefix}[${items.join(", ")}]${end?.[1] ?? ""}`;
    if (items.length > 0 && items.length <= 4 && end && inline.length <= 100) {
      output.push(inline);
      index = cursor;
      continue;
    }

    output.push(line);
  }

  return output.join("\n");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
