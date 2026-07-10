import { access, readdir, readFile, stat } from "node:fs/promises";
import path, { extname, join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import { AgentSkillManifestSchema, type AgentSkillManifest } from "@quickdeployai/agent-skill-registry-schemas";
import { loadSkillPackage, toPosixPath } from "@quickdeployai/agent-skill-core";
import { resolveManifestSourceRoot } from "./registry-build";

export type RegistryValidationCode =
  | "invalid-manifest"
  | "invalid-registry-path"
  | "namespace-mismatch"
  | "duplicate-name"
  | "invalid-source"
  | "missing-skill"
  | "malformed-skill"
  | "missing-artifact";

export interface RegistryValidationViolation {
  code: RegistryValidationCode;
  path: string;
  name?: string;
  message: string;
}

export interface RegistryValidationResult {
  ok: boolean;
  entryCount: number;
  violations: RegistryValidationViolation[];
}

export interface RegistryValidateOptions {
  rootDir: string;
}

interface DiscoveredEntry {
  path: string;
  provider: string;
  manifest: AgentSkillManifest;
}

const QUICKDEPLOY_NAME_PREFIX = "ai.quickdeploy/";
const MANIFEST_EXTENSIONS = new Set([".json", ".yaml", ".yml"]);

export async function validateRegistryEntries(
  options: RegistryValidateOptions,
): Promise<RegistryValidationResult> {
  const violations: RegistryValidationViolation[] = [];
  const entries = await discoverRegistryEntries(options.rootDir, violations);

  for (const entry of entries) {
    await validateEntry(options.rootDir, entry, violations);
  }
  validateNoDuplicateNames(entries, violations);

  return {
    ok: violations.length === 0,
    entryCount: entries.length,
    violations,
  };
}

export function formatRegistryValidationViolations(
  violations: readonly RegistryValidationViolation[],
): string {
  if (violations.length === 0) return "Agent skills registry validation passed.\n";
  return `${violations
    .map(
      (violation) =>
        `- [${violation.code}] ${violation.path}${violation.name ? ` (${violation.name})` : ""}: ${violation.message}`,
    )
    .join("\n")}\n`;
}

async function validateEntry(
  rootDir: string,
  entry: DiscoveredEntry,
  violations: RegistryValidationViolation[],
): Promise<void> {
  const { manifest, path: sourcePath, provider } = entry;
  const isQuickDeployProvider = provider === "quickdeploy";
  const hasQuickDeployPrefix = manifest.metadata.name.startsWith(QUICKDEPLOY_NAME_PREFIX);

  if (isQuickDeployProvider && !hasQuickDeployPrefix) {
    violations.push({
      code: "namespace-mismatch",
      path: sourcePath,
      name: manifest.metadata.name,
      message: `QuickDeploy-owned skills must use the "${QUICKDEPLOY_NAME_PREFIX}" namespace.`,
    });
  }
  if (!isQuickDeployProvider && hasQuickDeployPrefix) {
    violations.push({
      code: "namespace-mismatch",
      path: sourcePath,
      name: manifest.metadata.name,
      message: `Third-party entries must not use the "${QUICKDEPLOY_NAME_PREFIX}" namespace.`,
    });
  }

  if (manifest.spec.source.type !== "file") {
    violations.push({
      code: "invalid-source",
      path: sourcePath,
      name: manifest.metadata.name,
      message: "V1 registry entries must point at reviewed local skill packages.",
    });
    return;
  }

  let sourceRoot: string;
  try {
    sourceRoot = resolveManifestSourceRoot(rootDir, manifest);
  } catch (error) {
    violations.push({
      code: "invalid-source",
      path: sourcePath,
      name: manifest.metadata.name,
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  try {
    await loadSkillPackage(sourceRoot, manifest.spec.package.entrypoint);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    violations.push({
      code: message.includes("ENOENT") ? "missing-skill" : "malformed-skill",
      path: sourcePath,
      name: manifest.metadata.name,
      message,
    });
  }

  for (const artifactPath of [
    ...manifest.spec.package.artifacts.scripts,
    ...manifest.spec.package.artifacts.references,
    ...manifest.spec.package.artifacts.assets,
  ]) {
    try {
      const fileStat = await stat(join(sourceRoot, artifactPath));
      if (!fileStat.isFile()) throw new Error("not a file");
    } catch {
      violations.push({
        code: "missing-artifact",
        path: sourcePath,
        name: manifest.metadata.name,
        message: `Declared artifact does not exist: ${artifactPath}`,
      });
    }
  }
}

function validateNoDuplicateNames(
  entries: readonly DiscoveredEntry[],
  violations: RegistryValidationViolation[],
): void {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    const firstPath = seen.get(entry.manifest.metadata.name);
    if (firstPath) {
      violations.push({
        code: "duplicate-name",
        path: entry.path,
        name: entry.manifest.metadata.name,
        message: `Duplicate skill name also declared at ${firstPath}.`,
      });
    } else {
      seen.set(entry.manifest.metadata.name, entry.path);
    }
  }
}

async function discoverRegistryEntries(
  rootDir: string,
  violations: RegistryValidationViolation[],
): Promise<DiscoveredEntry[]> {
  const registryDir = join(rootDir, "registry");
  const files = await findFiles(registryDir, (name, filePath) => {
    const relativePath = toPosixPath(relative(rootDir, filePath));
    if (relativePath === "registry/index.json") return false;
    return name.includes(".skill.") && MANIFEST_EXTENSIONS.has(extname(name));
  });

  const entries: DiscoveredEntry[] = [];
  for (const filePath of files) {
    const relativePath = toPosixPath(relative(rootDir, filePath));
    const provider = providerFromRegistryPath(relativePath);
    if (!provider) {
      violations.push({
        code: "invalid-registry-path",
        path: relativePath,
        message: "Registry sources must live under registry/<provider>/.",
      });
      continue;
    }

    try {
      const raw = await readStructuredFile(filePath);
      entries.push({
        path: relativePath,
        provider,
        manifest: AgentSkillManifestSchema.parse(raw),
      });
    } catch (error) {
      violations.push({
        code: "invalid-manifest",
        path: relativePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return entries;
}

async function readStructuredFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf8");
  if (filePath.endsWith(".json")) return JSON.parse(raw) as unknown;
  return parseYaml(raw) as unknown;
}

function providerFromRegistryPath(relativePath: string): string | null {
  const parts = relativePath.split("/");
  if (parts.length < 3 || parts[0] !== "registry") return null;
  return parts[1] ?? null;
}

async function findFiles(
  dir: string,
  predicate: (name: string, path: string) => boolean,
): Promise<string[]> {
  const files: string[] = [];
  try {
    await access(dir);
  } catch {
    return files;
  }

  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
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
