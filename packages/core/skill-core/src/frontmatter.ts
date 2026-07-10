import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { SkillFrontmatterSchema, type SkillFrontmatter } from "@quickdeployai/skill-registry-schemas";

export interface ParsedSkillMarkdown {
  frontmatter: SkillFrontmatter;
  body: string;
}

/**
 * Parse SKILL.md into frontmatter + body. The delimiter handling matches
 * MCP-Registry's agent-skills-2-mcp skill-loader so both sides accept the
 * same documents; on top of that the frontmatter is validated against the
 * shared SkillFrontmatterSchema instead of only checking name/description.
 */
export function parseSkillMarkdown(content: string): ParsedSkillMarkdown {
  const trimmed = content.trim();

  if (!trimmed.startsWith("---")) {
    throw new Error("SKILL.md must start with YAML frontmatter (---)");
  }

  const endIndex = trimmed.indexOf("---", 3);
  if (endIndex === -1) {
    throw new Error("SKILL.md frontmatter is not closed (missing closing ---)");
  }

  const yamlContent = trimmed.slice(3, endIndex).trim();
  const body = trimmed.slice(endIndex + 3).trim();
  const frontmatter = SkillFrontmatterSchema.parse(parseYaml(yamlContent));

  return { frontmatter, body };
}

export function serializeSkillMarkdown(parsed: ParsedSkillMarkdown): string {
  const frontmatter = SkillFrontmatterSchema.parse(parsed.frontmatter);
  return `---\n${stringifyYaml(frontmatter).trimEnd()}\n---\n\n${parsed.body.trim()}\n`;
}
