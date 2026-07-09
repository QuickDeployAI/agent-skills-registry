import { join } from "node:path";
import { loadSkillDir, validateSkillAgainstManifest } from "@quickdeployai/skill-core";
import { QUICKDEPLOY_SKILL_NAME_PREFIX } from "@quickdeployai/skill-registry-schemas";
import { discoverRegistrySources } from "./registry-discovery.js";

export type RegistryValidationCode =
  | "invalid-source"
  | "name-namespace-mismatch"
  | "duplicate-name"
  | "missing-skill-directory"
  | "skill-content-mismatch";

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

/**
 * Validate every registry source against the rules the skills.json build
 * doesn't enforce by construction: namespace ownership, cross-entry name
 * duplicates, and — for materialized first-party skills — that the committed
 * skill directory exists and agrees with its manifest (frontmatter identity,
 * safety mirrors, declared references/scripts).
 *
 * Like MCP-Registry's registry-cli, this never throws on the first bad
 * entry — it collects every violation so CI reports the full picture.
 */
export async function validateRegistryEntries(
  options: RegistryValidateOptions,
): Promise<RegistryValidationResult> {
  const violations: RegistryValidationViolation[] = [];
  const { sources, problems } = await discoverRegistrySources(options.rootDir);

  for (const problem of problems) {
    violations.push({ code: "invalid-source", path: problem.path, message: problem.message });
  }

  const seenNames = new Map<string, string>();
  const seenSkillSlugs = new Map<string, string>();

  for (const source of sources) {
    if (source.kind === "skillset") {
      const name = source.skillset.metadata.name;
      if (name.startsWith(QUICKDEPLOY_SKILL_NAME_PREFIX)) {
        violations.push({
          code: "name-namespace-mismatch",
          path: source.path,
          name,
          message: `Skill sets pin external skills and must use the provider's real namespace, not "${QUICKDEPLOY_SKILL_NAME_PREFIX}".`,
        });
      }
      registerName(seenNames, name, source.path, violations);
      for (const pin of source.skillset.spec.skills) {
        registerSlug(seenSkillSlugs, pin.name, source.path, violations);
      }
      continue;
    }

    const manifest = source.manifest;
    registerName(seenNames, manifest.metadata.name, source.path, violations);
    registerSlug(seenSkillSlugs, manifest.spec.skill.name, source.path, violations);

    if (manifest.spec.source.type === "file") {
      await validateMaterializedSkill(options.rootDir, source.path, manifest, violations);
    }
  }

  return { ok: violations.length === 0, entryCount: sources.length, violations };
}

async function validateMaterializedSkill(
  rootDir: string,
  path: string,
  manifest: Parameters<typeof validateSkillAgainstManifest>[1],
  violations: RegistryValidationViolation[],
): Promise<void> {
  const skillDir = join(rootDir, manifest.spec.output.path);
  const skill = await loadSkillDir(skillDir).catch((error: unknown) => {
    violations.push({
      code: "missing-skill-directory",
      path,
      name: manifest.metadata.name,
      message: `spec.output.path "${manifest.spec.output.path}" is not a loadable skill directory: ${error instanceof Error ? error.message : String(error)}`,
    });
    return null;
  });
  if (!skill) return;

  for (const violation of validateSkillAgainstManifest(skill, manifest)) {
    violations.push({
      code: "skill-content-mismatch",
      path,
      name: manifest.metadata.name,
      message: violation.message,
    });
  }
}

function registerName(
  seen: Map<string, string>,
  name: string,
  path: string,
  violations: RegistryValidationViolation[],
): void {
  const firstPath = seen.get(name);
  if (firstPath) {
    violations.push({
      code: "duplicate-name",
      path,
      name,
      message: `Duplicate registry name "${name}" also declared at ${firstPath}.`,
    });
  } else {
    seen.set(name, path);
  }
}

function registerSlug(
  seen: Map<string, string>,
  slug: string,
  path: string,
  violations: RegistryValidationViolation[],
): void {
  const firstPath = seen.get(slug);
  if (firstPath) {
    violations.push({
      code: "duplicate-name",
      path,
      name: slug,
      message: `Duplicate skill slug "${slug}" also declared at ${firstPath}; agent-skills-2-mcp rejects duplicate skill names.`,
    });
  } else {
    seen.set(slug, path);
  }
}

export function formatRegistryValidationViolations(
  violations: RegistryValidationViolation[],
): string {
  if (violations.length === 0) return "Registry validation passed.\n";
  const lines = violations.map(
    (violation) =>
      `- [${violation.code}] ${violation.path}${violation.name ? ` (${violation.name})` : ""}: ${violation.message}`,
  );
  return `${lines.join("\n")}\n`;
}
