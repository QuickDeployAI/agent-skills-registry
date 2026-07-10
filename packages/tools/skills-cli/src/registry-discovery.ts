import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import {
  SkillManifestSchema,
  SkillSetSchema,
  type SkillManifest,
  type SkillSet,
} from "@quickdeployai/skill-registry-schemas";

export type RegistrySourceKind = "skill-manifest" | "skillset";

export interface DiscoveredSkillManifest {
  kind: "skill-manifest";
  path: string;
  manifest: SkillManifest;
}

export interface DiscoveredSkillSet {
  kind: "skillset";
  path: string;
  skillset: SkillSet;
}

export type DiscoveredRegistrySource = DiscoveredSkillManifest | DiscoveredSkillSet;

export interface DiscoveryProblem {
  path: string;
  message: string;
}

export interface RegistryDiscoveryResult {
  sources: DiscoveredRegistrySource[];
  problems: DiscoveryProblem[];
}

export function isSkillManifestFileName(name: string): boolean {
  return name.endsWith(".skill.json");
}

export function isSkillSetFileName(name: string): boolean {
  return name.endsWith(".skillset.json");
}

export function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function isProviderRegistryPath(path: string): boolean {
  const parts = path.split("/");
  return parts[0] === "registry" && Boolean(parts[1]) && parts.length >= 3;
}

/**
 * Discover authored registry sources under `registry/<provider>/`:
 * `*.skill.json` (first-party SkillManifest) and `*.skillset.json`
 * (externally pinned skills). Parse failures are collected as problems
 * rather than thrown so callers can report every bad source in one pass.
 */
export async function discoverRegistrySources(rootDir: string): Promise<RegistryDiscoveryResult> {
  const problems: DiscoveryProblem[] = [];
  const sources: DiscoveredRegistrySource[] = [];
  const files = await findFiles(join(rootDir, "registry"), (name) => {
    return isSkillManifestFileName(name) || isSkillSetFileName(name);
  });

  for (const file of files) {
    const relativePath = normalizePath(relative(rootDir, file));
    if (relativePath === "registry/index.json") continue;
    if (!isProviderRegistryPath(relativePath)) {
      problems.push({
        path: relativePath,
        message: "Registry sources must live under registry/<provider>/.",
      });
      continue;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(await readFile(file, "utf8"));
    } catch (error) {
      problems.push({
        path: relativePath,
        message: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }

    if (isSkillManifestFileName(relativePath)) {
      const parsed = SkillManifestSchema.safeParse(raw);
      if (!parsed.success) {
        problems.push({ path: relativePath, message: formatZodIssues(parsed.error.issues) });
        continue;
      }
      sources.push({ kind: "skill-manifest", path: relativePath, manifest: parsed.data });
    } else {
      const parsed = SkillSetSchema.safeParse(raw);
      if (!parsed.success) {
        problems.push({ path: relativePath, message: formatZodIssues(parsed.error.issues) });
        continue;
      }
      sources.push({ kind: "skillset", path: relativePath, skillset: parsed.data });
    }
  }

  return { sources, problems };
}

function formatZodIssues(issues: { path: PropertyKey[]; message: string }[]): string {
  return issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
}

async function findFiles(
  dir: string,
  predicate: (name: string) => boolean,
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    },
  );
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return findFiles(path, predicate);
      if (entry.isFile() && predicate(entry.name)) return [path];
      return [];
    }),
  );
  return files.flat().sort((left, right) => normalizePath(left).localeCompare(normalizePath(right)));
}
