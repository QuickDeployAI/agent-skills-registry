import {
  SKILL_SAFETY_DESTRUCTIVE_OPS_META_KEY,
  SKILL_SAFETY_READ_ONLY_META_KEY,
  SKILL_SAFETY_SANDBOX_DEFAULT_META_KEY,
  type SkillManifest,
} from "@quickdeployai/skill-registry-schemas";
import type { LoadedSkill } from "./skill-dir.js";

export interface SkillValidationViolation {
  code:
    | "frontmatter-manifest-mismatch"
    | "safety-mirror-mismatch"
    | "missing-referenced-file"
    | "undeclared-script";
  message: string;
}

/**
 * Cross-check a loaded skill directory against its SkillManifest: the
 * frontmatter must restate the manifest identity, the string safety mirrors
 * in frontmatter metadata must agree with the structured spec.safety block,
 * every declared reference/script file must exist, and no script may exist
 * on disk without being declared (scripts surface as MCP tools, so silent
 * additions are a safety hole). Collects all violations, never fail-fast.
 */
export function validateSkillAgainstManifest(
  skill: LoadedSkill,
  manifest: SkillManifest,
): SkillValidationViolation[] {
  const violations: SkillValidationViolation[] = [];

  if (skill.frontmatter.name !== manifest.spec.skill.name) {
    violations.push({
      code: "frontmatter-manifest-mismatch",
      message: `Frontmatter name "${skill.frontmatter.name}" does not match manifest spec.skill.name "${manifest.spec.skill.name}".`,
    });
  }
  if (skill.frontmatter.description !== manifest.spec.skill.description) {
    violations.push({
      code: "frontmatter-manifest-mismatch",
      message: "Frontmatter description does not match manifest spec.skill.description.",
    });
  }

  validateSafetyMirrors(skill, manifest, violations);
  validateDeclaredFiles(skill, manifest, violations);

  return violations;
}

function validateSafetyMirrors(
  skill: LoadedSkill,
  manifest: SkillManifest,
  violations: SkillValidationViolation[],
): void {
  const metadata = skill.frontmatter.metadata ?? {};
  const safety = manifest.spec.safety;

  const expectedMirrors: Record<string, string> = {
    [SKILL_SAFETY_READ_ONLY_META_KEY]: String(safety.readOnly),
    [SKILL_SAFETY_SANDBOX_DEFAULT_META_KEY]: safety.sandbox.defaultMode,
  };
  if (safety.destructiveOperations.length > 0) {
    expectedMirrors[SKILL_SAFETY_DESTRUCTIVE_OPS_META_KEY] = safety.destructiveOperations
      .map((operation) => operation.name)
      .join(",");
  }

  for (const [key, expected] of Object.entries(expectedMirrors)) {
    const actual = metadata[key];
    if (actual !== expected) {
      violations.push({
        code: "safety-mirror-mismatch",
        message: `Frontmatter metadata["${key}"] must be "${expected}" to mirror spec.safety (got ${actual === undefined ? "nothing" : `"${actual}"`}).`,
      });
    }
  }
}

function validateDeclaredFiles(
  skill: LoadedSkill,
  manifest: SkillManifest,
  violations: SkillValidationViolation[],
): void {
  const presentFiles = new Set([
    ...skill.scripts.map((path) => `scripts/${path}`),
    ...skill.references.map((path) => `references/${path}`),
    ...skill.assets.map((path) => `assets/${path}`),
  ]);

  for (const reference of manifest.spec.references) {
    if (!presentFiles.has(reference.path)) {
      violations.push({
        code: "missing-referenced-file",
        message: `Manifest references "${reference.path}" but the skill directory does not contain it.`,
      });
    }
  }
  for (const script of manifest.spec.scripts) {
    if (!presentFiles.has(script.path)) {
      violations.push({
        code: "missing-referenced-file",
        message: `Manifest declares script "${script.path}" but the skill directory does not contain it.`,
      });
    }
  }

  const declaredScripts = new Set(manifest.spec.scripts.map((script) => script.path));
  for (const script of skill.scripts) {
    const path = `scripts/${script}`;
    if (!declaredScripts.has(path)) {
      violations.push({
        code: "undeclared-script",
        message: `Skill directory contains "${path}" which is not declared in manifest spec.scripts.`,
      });
    }
  }
}
